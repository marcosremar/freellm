import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * SambaNova Cloud — permanent free tier, no credit card required.
 * Rate limits: 10–30 RPM depending on model.
 * Get a free key at: https://cloud.sambanova.ai/apis
 *
 * Automatically discovers available models via /v1/models.
 * SambaNova's free tier includes all listed models — no pricing filter needed.
 */
export class SambanovaProvider extends BaseProvider {
  readonly id = "sambanova";
  readonly name = "SambaNova";
  readonly baseUrl = "https://api.sambanova.ai/v1";

  /** Static fallback — updated dynamically by discoverModels() */
  models: ModelObject[] = [
    { id: "sambanova/Meta-Llama-3.3-70B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "sambanova" },
    { id: "sambanova/Meta-Llama-3.1-405B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "sambanova" },
    { id: "sambanova/Qwen2.5-72B-Instruct", object: "model", created: 1700000000, owned_by: "alibaba", provider: "sambanova" },
    { id: "sambanova/DeepSeek-R1", object: "model", created: 1700000000, owned_by: "deepseek", provider: "sambanova" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["SAMBANOVA_API_KEY"]);
  }

  /**
   * SambaNova's /v1/models lists all available models on the account's plan.
   * Since all listed models are included in the free tier, no pricing filter needed.
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
        data?: Array<{ id: string; owned_by?: string }>;
      };

      const discovered: ModelObject[] = (data.data ?? [])
        .filter((m) => m.id && !m.id.includes("embed")) // skip embedding models
        .map((m) => ({
          id: `sambanova/${m.id}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: m.owned_by ?? m.id.split("/")[0] ?? "unknown",
          provider: "sambanova",
        }));

      if (discovered.length > 0) {
        this.models = discovered;
        console.log(`[SambaNova] Discovered ${discovered.length} models`);
      }

      return this.models;
    } catch (e) {
      console.error(`[SambaNova] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
