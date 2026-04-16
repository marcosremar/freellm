import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * Together AI — free $25 credits on signup, no credit card required initially.
 * Rate limits: 60 RPM on free tier.
 * Get a free key at: https://api.together.ai/settings/api-keys
 *
 * Automatically discovers free models via /v1/models (pricing.input === 0).
 */
export class TogetherProvider extends BaseProvider {
  readonly id = "together";
  readonly name = "Together AI";
  readonly baseUrl = "https://api.together.xyz/v1";

  /** Static fallback — updated dynamically by discoverModels() */
  models: ModelObject[] = [
    { id: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo", object: "model", created: 1700000000, owned_by: "meta", provider: "together" },
    { id: "together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", object: "model", created: 1700000000, owned_by: "meta", provider: "together" },
    { id: "together/Qwen/Qwen2.5-72B-Instruct-Turbo", object: "model", created: 1700000000, owned_by: "alibaba", provider: "together" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["TOGETHER_API_KEY"]);
  }

  /**
   * Together AI does not expose a public balance API.
   * Check balance at: https://api.together.ai/settings/billing
   */
  async getBalance(): Promise<number | null> {
    return null; // No public balance API available
  }

  /**
   * Together AI /v1/models returns each model with a `pricing` object.
   * Free models have pricing.input === 0 and pricing.output === 0.
   */
  async discoverModels(): Promise<ModelObject[]> {
    const keys = this.getApiKeys();
    if (keys.length === 0) return this.models;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${keys[0]}` },
      });
      if (!response.ok) return this.models;

      const data = (await response.json()) as Array<{
        id: string;
        display_name?: string;
        organization?: string;
        pricing?: { input?: number; output?: number };
        type?: string;
      }>;

      // Together AI gives $25 credits on signup. Use production models (pricing > 0)
      // which are reliably available serverless. Models with pricing=0 are experimental
      // and often fail with "non-serverless" errors.
      const freeModels: ModelObject[] = data
        .filter(
          (m) =>
            m.type === "chat" &&
            (m.pricing?.input ?? 0) > 0 &&
            (m.pricing?.output ?? 0) > 0,
        )
        .map((m) => ({
          id: `together/${m.id}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: m.organization ?? m.id.split("/")[0] ?? "unknown",
          provider: "together",
        }));

      if (freeModels.length > 0) {
        this.models = freeModels;
        console.log(`[Together AI] Discovered ${freeModels.length} models (uses $25 credits)`);
      } else {
        console.warn(`[Together AI] No models found — keeping fallback list`);
      }

      return this.models;
    } catch (e) {
      console.error(`[Together AI] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
