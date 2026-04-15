import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * xAI Grok — $25 free credits on signup, no credit card required initially.
 * Optional $150/month additional credits via data-sharing program.
 * OpenAI-compatible API.
 * Get a free key at: https://console.x.ai/
 *
 * Automatically discovers available models via /v1/models.
 */
export class XaiProvider extends BaseProvider {
  readonly id = "xai";
  readonly name = "xAI Grok";
  readonly baseUrl = "https://api.x.ai/v1";

  /** Static fallback — updated dynamically by discoverModels() */
  models: ModelObject[] = [
    { id: "xai/grok-3-mini-fast", object: "model", created: 1700000000, owned_by: "xai", provider: "xai" },
    { id: "xai/grok-3-mini", object: "model", created: 1700000000, owned_by: "xai", provider: "xai" },
    { id: "xai/grok-3", object: "model", created: 1700000000, owned_by: "xai", provider: "xai" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["XAI_API_KEY"]);
  }

  /**
   * Discover available models from xAI API.
   * All models accessible with the key are included.
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
        .filter((m) => {
          const id = m.id.toLowerCase();
          // Skip embedding and vision-only models
          return !id.includes("embed") && !id.includes("vision");
        })
        .map((m) => ({
          id: `xai/${m.id}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: m.owned_by ?? "xai",
          provider: "xai",
        }));

      if (discovered.length > 0) {
        this.models = discovered;
        console.log(`[xAI] Discovered ${discovered.length} models`);
      }
      return this.models;
    } catch (e) {
      console.error(`[xAI] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
