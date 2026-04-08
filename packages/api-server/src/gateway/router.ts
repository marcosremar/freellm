import type { ProviderRegistry } from "./registry.js";
import type { ProviderAdapter } from "./providers/types.js";
import type { ChatCompletionRequest, ChatCompletionResponse, RoutingStrategy } from "./types.js";
import { RequestLog } from "./request-log.js";
import { UsageTracker } from "./usage-tracker.js";
import { ResponseCache } from "./cache.js";
import { META_MODELS, DEFAULT_MODELS, NON_RETRIABLE_STATUSES } from "./config.js";
import { assertStrictModeAllowed } from "./strict.js";

export type RouteReason = "direct" | "meta" | "cache" | "failover";

export interface RouteMeta {
  provider: string;
  resolvedModel: string;
  requestedModel: string;
  cached: boolean;
  reason: RouteReason;
  attempted: string[];
}

export interface RouteOptions {
  strict?: boolean;
}

const ROUTE_TIMEOUT_MS = parseInt(process.env["ROUTE_TIMEOUT_MS"] ?? "30000", 10);

export class GatewayRouter {
  // Round-robin index for explicit (non-meta) model requests
  private rrIndex = 0;
  // Per-meta-model round-robin indices for true rotation across providers
  private metaRrIndices = new Map<string, number>();

  public strategy: RoutingStrategy = "round_robin";
  public requestLog: RequestLog;
  public usageTracker: UsageTracker;
  public cache: ResponseCache;

  constructor(private registry: ProviderRegistry) {
    this.requestLog = new RequestLog();
    this.usageTracker = new UsageTracker();
    this.cache = new ResponseCache();
  }

  private pickProvider(
    modelId: string,
    excluded: Set<string>,
  ): ProviderAdapter | undefined {
    if (META_MODELS.has(modelId)) {
      return this.registry.getProviderForMetaModel(
        modelId,
        excluded,
        this.strategy,
        this.getMetaRrIndex(modelId),
        (next) => this.setMetaRrIndex(modelId, next),
      );
    }

    const available = this.registry
      .getAvailable()
      .filter((p) => !excluded.has(p.id) && p.models.some((m) => m.id === modelId));

    if (available.length === 0) return undefined;

    if (this.strategy === "random") {
      return available[Math.floor(Math.random() * available.length)];
    }

    // round_robin
    const idx = this.rrIndex % available.length;
    this.rrIndex = (this.rrIndex + 1) % 1_000_000;
    return available[idx];
  }

  private getMetaRrIndex(metaModel: string): number {
    return this.metaRrIndices.get(metaModel) ?? 0;
  }

  private setMetaRrIndex(metaModel: string, next: number): void {
    this.metaRrIndices.set(metaModel, next % 1_000_000);
  }

  private resolveModelForProvider(
    requestedModel: string,
    provider: ProviderAdapter,
  ): string {
    if (META_MODELS.has(requestedModel)) {
      const defaultModel = DEFAULT_MODELS[provider.id];
      if (defaultModel) {
        const prefixed = `${provider.id}/${defaultModel}`;
        if (provider.models.some((m) => m.id === prefixed)) return prefixed;
      }
      const first = provider.models[0];
      return first ? first.id : requestedModel;
    }
    return requestedModel;
  }

  async route(
    request: ChatCompletionRequest,
    options: RouteOptions = {},
  ): Promise<{
    response: Response;
    provider: ProviderAdapter;
    resolvedModel: string;
    attempted: string[];
    failoverCount: number;
  }> {
    const strict = options.strict === true;
    assertStrictModeAllowed(request.model, strict);

    const excluded = new Set<string>();
    const attempted: string[] = [];
    let failoverCount = 0;
    const deadline = Date.now() + ROUTE_TIMEOUT_MS;

    while (true) {
      if (Date.now() > deadline) {
        throw new AllProvidersExhaustedError(
          `Routing timeout (${ROUTE_TIMEOUT_MS}ms) exceeded for model: ${request.model}`,
          [...excluded],
        );
      }

      const provider = this.pickProvider(request.model, excluded);

      if (!provider) {
        throw new AllProvidersExhaustedError(
          `All providers exhausted for model: ${request.model}`,
          [...excluded],
        );
      }

      if (!attempted.includes(provider.id)) attempted.push(provider.id);

      const resolvedModel = this.resolveModelForProvider(request.model, provider);
      const mappedRequest = { ...request, model: resolvedModel };

      try {
        const response = await provider.complete(mappedRequest);

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          provider.onRateLimit(response, retryAfter ? parseInt(retryAfter, 10) : undefined);
          // Only exclude the provider if ALL its keys are now rate-limited.
          // Otherwise the next iteration can pick a different key from the same provider.
          if (!provider.isAvailable()) {
            excluded.add(provider.id);
          }
          // Strict mode never falls back to a different provider.
          if (strict) {
            throw new ProviderClientError(provider.id, response.status, response);
          }
          failoverCount++;
          continue;
        }

        if (NON_RETRIABLE_STATUSES.has(response.status)) {
          throw new ProviderClientError(provider.id, response.status, response);
        }

        if (response.status >= 500) {
          provider.onError();
          excluded.add(provider.id);
          if (strict) {
            throw new ProviderClientError(provider.id, response.status, response);
          }
          failoverCount++;
          continue;
        }

        if (!response.ok) {
          provider.onError();
          excluded.add(provider.id);
          if (strict) {
            throw new ProviderClientError(provider.id, response.status, response);
          }
          failoverCount++;
          continue;
        }

        provider.onSuccess(response);
        return { response, provider, resolvedModel, attempted, failoverCount };
      } catch (err) {
        if (err instanceof ProviderClientError) throw err;
        provider.onError();
        excluded.add(provider.id);
        if (strict) throw err;
        failoverCount++;
      }
    }
  }

  async complete(
    request: ChatCompletionRequest,
    options: RouteOptions = {},
  ): Promise<{ data: ChatCompletionResponse; meta: RouteMeta }> {
    const startTime = Date.now();
    const strict = options.strict === true;

    // Cache check FIRST. Hits short-circuit the entire routing flow:
    // no provider call, no token quota burn, ~0ms latency.
    // Strict mode disables the cache because a cached response may have
    // come from a different provider than the caller expects.
    const cached = strict ? null : this.cache.get(request);
    if (cached) {
      const latencyMs = Date.now() - startTime;
      const data: ChatCompletionResponse = {
        ...cached.response,
        x_freellm_provider: cached.provider,
        x_freellm_cached: true,
      };

      this.requestLog.add({
        requestedModel: request.model,
        resolvedModel: cached.response.model,
        provider: cached.provider,
        latencyMs,
        status: "success",
        streaming: false,
        promptTokens: cached.promptTokens || undefined,
        completionTokens: cached.completionTokens || undefined,
        cached: true,
      });

      const meta: RouteMeta = {
        provider: cached.provider,
        resolvedModel: cached.response.model,
        requestedModel: request.model,
        cached: true,
        reason: "cache",
        attempted: [cached.provider],
      };
      return { data, meta };
    }

    try {
      const { response, provider, resolvedModel, attempted, failoverCount } =
        await this.route(request, options);
      const latencyMs = Date.now() - startTime;

      const data = (await response.json()) as ChatCompletionResponse;
      data.x_freellm_provider = provider.id;

      // Extract and record token usage when the provider returns it (all
      // OpenAI-compatible providers do for non-streaming responses).
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      if (promptTokens > 0 || completionTokens > 0) {
        this.usageTracker.record(provider.id, promptTokens, completionTokens);
      }

      this.requestLog.add({
        requestedModel: request.model,
        resolvedModel,
        provider: provider.id,
        latencyMs,
        status: "success",
        streaming: false,
        promptTokens: promptTokens || undefined,
        completionTokens: completionTokens || undefined,
      });

      // Store in cache for future identical requests.
      // The cache class skips streaming and disabled state internally.
      this.cache.set(request, data, provider.id, promptTokens, completionTokens);

      const meta: RouteMeta = {
        provider: provider.id,
        resolvedModel,
        requestedModel: request.model,
        cached: false,
        reason: META_MODELS.has(request.model)
          ? "meta"
          : failoverCount > 0
            ? "failover"
            : "direct",
        attempted,
      };
      return { data, meta };
    } catch (err) {
      const latencyMs = Date.now() - startTime;

      if (err instanceof AllProvidersExhaustedError) {
        this.requestLog.add({
          requestedModel: request.model,
          latencyMs,
          status: "all_providers_failed",
          error: err.message,
          streaming: false,
        });
        throw err;
      }

      this.requestLog.add({
        requestedModel: request.model,
        latencyMs,
        status: "error",
        error: String(err),
        streaming: false,
      });
      throw err;
    }
  }

  async routeStream(
    request: ChatCompletionRequest,
    options: RouteOptions = {},
  ): Promise<{
    response: Response;
    provider: ProviderAdapter;
    resolvedModel: string;
    latencyMs: number;
    attempted: string[];
    failoverCount: number;
  }> {
    const startTime = Date.now();
    const result = await this.route(request, options);
    return { ...result, latencyMs: Date.now() - startTime };
  }
}

export class AllProvidersExhaustedError extends Error {
  constructor(
    message: string,
    public readonly triedProviders: string[],
  ) {
    super(message);
    this.name = "AllProvidersExhaustedError";
  }
}

/** Thrown when a provider returns a non-retriable 4xx (400/401/403/404). */
export class ProviderClientError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly statusCode: number,
    public readonly upstreamResponse: Response,
  ) {
    super(`Provider ${providerId} returned ${statusCode}`);
    this.name = "ProviderClientError";
  }
}
