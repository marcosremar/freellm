import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * OpenRouter provider — aggregates 29+ free models from multiple providers.
 *
 * Unlike other providers that have a fixed model list, OpenRouter can
 * dynamically discover free models via /api/v1/models. The static list
 * below is a fallback; call discoverFreeModels() to refresh.
 *
 * Set OPENROUTER_API_KEY (comma-separated for multiple keys).
 */
export class OpenRouterProvider extends BaseProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";
  readonly baseUrl = "https://openrouter.ai/api/v1";

  /** Static fallback list of known free models with tool calling */
  models: ModelObject[] = [
    { id: "openrouter/qwen/qwen3-coder:free", object: "model", created: 1700000000, owned_by: "qwen", provider: "openrouter" },
    { id: "openrouter/arcee-ai/trinity-large-preview:free", object: "model", created: 1700000000, owned_by: "arcee", provider: "openrouter" },
    { id: "openrouter/google/gemma-4-31b-it:free", object: "model", created: 1700000000, owned_by: "google", provider: "openrouter" },
    { id: "openrouter/meta-llama/llama-3.3-70b-instruct:free", object: "model", created: 1700000000, owned_by: "meta", provider: "openrouter" },
    { id: "openrouter/openai/gpt-oss-120b:free", object: "model", created: 1700000000, owned_by: "openai", provider: "openrouter" },
    { id: "openrouter/minimax/minimax-m2.5:free", object: "model", created: 1700000000, owned_by: "minimax", provider: "openrouter" },
    { id: "openrouter/nvidia/nemotron-3-super-120b-a12b:free", object: "model", created: 1700000000, owned_by: "nvidia", provider: "openrouter" },
    { id: "openrouter/google/gemma-4-26b-a4b-it:free", object: "model", created: 1700000000, owned_by: "google", provider: "openrouter" },
    { id: "openrouter/z-ai/glm-4.5-air:free", object: "model", created: 1700000000, owned_by: "z-ai", provider: "openrouter" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["OPENROUTER_API_KEY"]);
  }

  /**
   * OpenRouter model IDs are prefixed with "openrouter/" in FreeLLM,
   * but the actual API expects the raw model ID (e.g. "qwen/qwen3-coder:free").
   */
  protected override mapRequest(request: import("../types.js").ChatCompletionRequest) {
    const mapped = { ...request };
    // Strip "openrouter/" prefix
    if (mapped.model.startsWith("openrouter/")) {
      mapped.model = mapped.model.slice("openrouter/".length);
    }
    return mapped;
  }

  /**
   * Discover free models dynamically from the OpenRouter API.
   * Free models have pricing.prompt === "0" && pricing.completion === "0".
   * Called on startup and periodically by the registry.
   */
  async discoverModels(): Promise<ModelObject[]> {
    const keys = this.getApiKeys();
    if (keys.length === 0) return this.models;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${keys[0]}` },
      });

      if (!response.ok) return this.models;

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          name?: string;
          pricing?: { prompt?: string; completion?: string };
          context_length?: number;
          architecture?: { modality?: string };
        }>;
      };

      const freeModels: ModelObject[] = data.data
        .filter((m) => {
          const isFree =
            m.pricing?.prompt === "0" && m.pricing?.completion === "0";
          return isFree;
        })
        .map((m) => ({
          id: `openrouter/${m.id}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: m.id.split("/")[0] ?? "unknown",
          provider: "openrouter",
        }));

      if (freeModels.length > 0) {
        this.models = freeModels;
        console.log(
          `[OpenRouter] Discovered ${freeModels.length} free models`,
        );
      }

      return this.models;
    } catch (e) {
      console.error(`[OpenRouter] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
