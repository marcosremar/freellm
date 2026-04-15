import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * AI21 Labs — $10 trial credits, 3 months, no credit card required.
 * Rate limits: 200 RPM, 10 RPS.
 * Models: Jamba (hybrid Mamba-Transformer architecture).
 * Get a free key at: https://studio.ai21.com/account/api-key
 *
 * AI21 exposes an OpenAI-compatible endpoint at /v1/chat/completions.
 * Automatically discovers available models via /v1/models.
 */
export class Ai21Provider extends BaseProvider {
  readonly id = "ai21";
  readonly name = "AI21 Labs";
  readonly baseUrl = "https://api.ai21.com/studio/v1";

  /** Static fallback — updated dynamically by discoverModels() */
  models: ModelObject[] = [
    { id: "ai21/jamba-mini-1.6", object: "model", created: 1700000000, owned_by: "ai21", provider: "ai21" },
    { id: "ai21/jamba-large-1.6", object: "model", created: 1700000000, owned_by: "ai21", provider: "ai21" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["AI21_API_KEY"]);
  }

  /**
   * Discover available models from AI21 API.
   */
  async discoverModels(): Promise<ModelObject[]> {
    const keys = this.getApiKeys();
    if (keys.length === 0) return this.models;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${keys[0]}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) return this.models;

      const data = (await response.json()) as {
        data?: Array<{ id: string; owned_by?: string }>;
      } | Array<{ id: string; owned_by?: string }>;

      const items = Array.isArray(data) ? data : (data.data ?? []);

      const discovered: ModelObject[] = items
        .filter((m) => {
          const id = m.id.toLowerCase();
          return !id.includes("embed") && !id.includes("j2-") // skip legacy J2 models
        })
        .map((m) => ({
          id: `ai21/${m.id}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: m.owned_by ?? "ai21",
          provider: "ai21",
        }));

      if (discovered.length > 0) {
        this.models = discovered;
        console.log(`[AI21] Discovered ${discovered.length} models`);
      }
      return this.models;
    } catch (e) {
      console.error(`[AI21] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
