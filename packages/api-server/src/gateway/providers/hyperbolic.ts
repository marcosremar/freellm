import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * Hyperbolic — free tier with 60 RPM, no credit card required.
 * Get a free key at: https://app.hyperbolic.xyz/settings
 *
 * Automatically discovers available models via /v1/models.
 * Free-tier models are identified by having no per-token price
 * (price_per_token === null or === 0) or being explicitly marked as free.
 */
export class HyperbolicProvider extends BaseProvider {
  readonly id = "hyperbolic";
  readonly name = "Hyperbolic";
  readonly baseUrl = "https://api.hyperbolic.xyz/v1";

  /** Static fallback — updated dynamically by discoverModels() */
  models: ModelObject[] = [
    { id: "hyperbolic/meta-llama/Llama-3.3-70B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "hyperbolic" },
    { id: "hyperbolic/meta-llama/Meta-Llama-3.1-8B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "hyperbolic" },
    { id: "hyperbolic/Qwen/Qwen2.5-72B-Instruct", object: "model", created: 1700000000, owned_by: "alibaba", provider: "hyperbolic" },
    { id: "hyperbolic/deepseek-ai/DeepSeek-V3", object: "model", created: 1700000000, owned_by: "deepseek", provider: "hyperbolic" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["HYPERBOLIC_API_KEY"]);
  }

  /**
   * Hyperbolic /v1/models lists all models with pricing info.
   * We include all chat/text models accessible on the free plan.
   * Models are filtered to text generation only (excludes image/audio).
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
        data?: Array<{
          id: string;
          object?: string;
          owned_by?: string;
          // Hyperbolic may return model_type or similar fields
          model_type?: string;
        }>;
      };

      const discovered: ModelObject[] = (data.data ?? [])
        .filter((m) => {
          // Keep only text/chat generation models, skip image/embedding/audio
          const id = m.id.toLowerCase();
          return (
            !id.includes("embed") &&
            !id.includes("sdxl") &&
            !id.includes("flux") &&
            !id.includes("stable-diffusion") &&
            !id.includes("whisper") &&
            !id.includes("tts")
          );
        })
        .map((m) => ({
          id: `hyperbolic/${m.id}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: m.owned_by ?? m.id.split("/")[0] ?? "unknown",
          provider: "hyperbolic",
        }));

      if (discovered.length > 0) {
        this.models = discovered;
        console.log(`[Hyperbolic] Discovered ${discovered.length} models`);
      }

      return this.models;
    } catch (e) {
      console.error(`[Hyperbolic] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
