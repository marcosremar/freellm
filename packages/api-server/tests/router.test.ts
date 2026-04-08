import { describe, it, expect, beforeEach } from "vitest";
import { GatewayRouter, AllProvidersExhaustedError, ProviderClientError } from "../src/gateway/router.js";
import type { ProviderRegistry } from "../src/gateway/registry.js";
import type { ProviderAdapter } from "../src/gateway/providers/types.js";
import type {
  ChatCompletionRequest,
  CircuitBreakerState,
  KeyStatus,
  ModelObject,
  ProviderStats,
  ProviderStatusInfo,
} from "../src/gateway/types.js";
import { StrictModeError } from "../src/gateway/strict.js";

interface FakeOptions {
  id: string;
  models: string[];
  /** Sequence of statuses to return on each call. Defaults to [200]. */
  statuses?: number[];
  /** Body returned for 200 responses. */
  body?: unknown;
}

class FakeProvider implements ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly models: ModelObject[];
  callCount = 0;
  private statuses: number[];
  private body: unknown;
  private cbState: CircuitBreakerState = "closed";
  private rateLimited = false;
  private statsObj: ProviderStats = {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
  };

  constructor(opts: FakeOptions) {
    this.id = opts.id;
    this.name = opts.id;
    this.models = opts.models.map((m) => ({
      id: m,
      object: "model" as const,
      created: 0,
      owned_by: opts.id,
      provider: opts.id,
    }));
    this.statuses = opts.statuses ?? [200];
    this.body = opts.body ?? {
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 0,
      model: opts.models[0],
      choices: [
        { index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    };
  }

  isEnabled(): boolean { return true; }
  isAvailable(): boolean { return !this.rateLimited; }
  getStats(): ProviderStats { return { ...this.statsObj }; }
  getCircuitBreakerState(): CircuitBreakerState { return this.cbState; }
  getKeysStatus(): KeyStatus[] {
    return [{
      index: 0,
      rateLimited: this.rateLimited,
      requestsInWindow: 0,
      maxRequests: 30,
      retryAfterMs: this.rateLimited ? 5_000 : null,
    }];
  }

  async complete(_request: ChatCompletionRequest): Promise<Response> {
    const idx = Math.min(this.callCount, this.statuses.length - 1);
    const status = this.statuses[idx]!;
    this.callCount++;
    this.statsObj.totalRequests++;
    if (status === 200) {
      return new Response(JSON.stringify(this.body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: { message: "upstream error" } }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  onSuccess(): void { this.statsObj.successRequests++; }
  onRateLimit(): void {
    this.statsObj.rateLimitedRequests++;
    this.rateLimited = true;
  }
  onError(): void {
    this.statsObj.failedRequests++;
    this.cbState = "open";
  }
  resetCircuitBreaker(): void {
    this.cbState = "closed";
    this.rateLimited = false;
  }
}

function fakeRegistry(providers: FakeProvider[]): ProviderRegistry {
  return {
    getAll: () => providers,
    getEnabled: () => providers,
    getAvailable: () => providers.filter((p) => p.isAvailable()),
    getById: (id: string) => providers.find((p) => p.id === id),
    getAllModels: () => providers.flatMap((p) => p.models),
    getProviderForMetaModel: (
      _meta: string,
      excluded: Set<string>,
    ): ProviderAdapter | undefined => {
      return providers.find((p) => p.isAvailable() && !excluded.has(p.id));
    },
    getStatusAll: (): ProviderStatusInfo[] => providers.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.isEnabled(),
      circuitBreakerState: p.getCircuitBreakerState(),
      totalRequests: p.getStats().totalRequests,
      successRequests: p.getStats().successRequests,
      failedRequests: p.getStats().failedRequests,
      rateLimitedRequests: p.getStats().rateLimitedRequests,
      lastError: null,
      lastUsedAt: null,
      models: p.models.map((m) => m.id),
      keyCount: 1,
      keysAvailable: p.isAvailable() ? 1 : 0,
      keys: p.getKeysStatus(),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, requestCount: 0 },
    })),
  } as unknown as ProviderRegistry;
}

const baseRequest = (model: string): ChatCompletionRequest => ({
  model,
  messages: [{ role: "user", content: "hi" }],
});

describe("GatewayRouter.complete (non-strict)", () => {
  let router: GatewayRouter;
  let groq: FakeProvider;
  let gemini: FakeProvider;

  beforeEach(() => {
    groq = new FakeProvider({ id: "groq", models: ["groq/llama"] });
    gemini = new FakeProvider({ id: "gemini", models: ["gemini/flash"] });
    router = new GatewayRouter(fakeRegistry([groq, gemini]));
  });

  it("returns meta with reason=direct on first-try success of a concrete model", async () => {
    const { data, meta } = await router.complete(baseRequest("groq/llama"));
    expect(data.choices[0].message.content).toBe("ok");
    expect(meta).toMatchObject({
      provider: "groq",
      resolvedModel: "groq/llama",
      requestedModel: "groq/llama",
      cached: false,
      reason: "direct",
    });
    expect(meta.attempted).toEqual(["groq"]);
  });

  it("marks reason=failover when first provider 500s and second succeeds", async () => {
    groq = new FakeProvider({ id: "groq", models: ["m"], statuses: [500] });
    gemini = new FakeProvider({ id: "gemini", models: ["m"] });
    router = new GatewayRouter(fakeRegistry([groq, gemini]));

    const { meta } = await router.complete(baseRequest("m"));
    expect(meta.provider).toBe("gemini");
    expect(meta.reason).toBe("failover");
    expect(meta.attempted).toEqual(["groq", "gemini"]);
  });

  it("throws AllProvidersExhaustedError when every provider fails", async () => {
    groq = new FakeProvider({ id: "groq", models: ["m"], statuses: [500] });
    gemini = new FakeProvider({ id: "gemini", models: ["m"], statuses: [500] });
    router = new GatewayRouter(fakeRegistry([groq, gemini]));

    await expect(router.complete(baseRequest("m"))).rejects.toBeInstanceOf(
      AllProvidersExhaustedError,
    );
  });
});

describe("GatewayRouter.complete (strict mode)", () => {
  it("rejects meta-models immediately", async () => {
    const groq = new FakeProvider({ id: "groq", models: ["groq/llama"] });
    const router = new GatewayRouter(fakeRegistry([groq]));
    await expect(router.complete(baseRequest("free"), { strict: true })).rejects.toBeInstanceOf(
      StrictModeError,
    );
    expect(groq.callCount).toBe(0);
  });

  it("does NOT failover after a 429 from the chosen provider", async () => {
    const groq = new FakeProvider({ id: "groq", models: ["m"], statuses: [429] });
    const gemini = new FakeProvider({ id: "gemini", models: ["m"] });
    const router = new GatewayRouter(fakeRegistry([groq, gemini]));

    await expect(router.complete(baseRequest("m"), { strict: true })).rejects.toBeInstanceOf(
      ProviderClientError,
    );
    expect(groq.callCount).toBe(1);
    expect(gemini.callCount).toBe(0);
  });

  it("does NOT failover after a 500 from the chosen provider", async () => {
    const groq = new FakeProvider({ id: "groq", models: ["m"], statuses: [500] });
    const gemini = new FakeProvider({ id: "gemini", models: ["m"] });
    const router = new GatewayRouter(fakeRegistry([groq, gemini]));

    await expect(router.complete(baseRequest("m"), { strict: true })).rejects.toBeInstanceOf(
      ProviderClientError,
    );
    expect(groq.callCount).toBe(1);
    expect(gemini.callCount).toBe(0);
  });

  it("succeeds when the chosen provider succeeds first try", async () => {
    const groq = new FakeProvider({ id: "groq", models: ["m"] });
    const router = new GatewayRouter(fakeRegistry([groq]));

    const { meta } = await router.complete(baseRequest("m"), { strict: true });
    expect(meta.provider).toBe("groq");
    expect(meta.reason).toBe("direct");
  });

  it("bypasses the cache (so a stale entry can't masquerade as fresh)", async () => {
    const groq = new FakeProvider({ id: "groq", models: ["m"] });
    const router = new GatewayRouter(fakeRegistry([groq]));
    // Prime the cache with a non-strict call.
    await router.complete(baseRequest("m"));
    expect(groq.callCount).toBe(1);
    // Strict call must hit the provider again, not the cache.
    await router.complete(baseRequest("m"), { strict: true });
    expect(groq.callCount).toBe(2);
  });
});
