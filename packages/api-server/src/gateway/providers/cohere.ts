import { BaseProvider, parseApiKeys } from "./base.js";
import type { ChatCompletionRequest, ModelObject } from "../types.js";

/**
 * Cohere — 1,000 API calls/month free, no credit card required.
 * Rate limits: 20 RPM chat, 5 RPM embed.
 * Get a free key at: https://dashboard.cohere.com/api-keys
 *
 * Cohere v2 API is OpenAI-compatible at /v2/chat.
 * Their message format is slightly different — role "system" becomes "system",
 * and the model IDs don't use the provider prefix on their end.
 *
 * Automatically discovers available models via /v2/models.
 */
export class CohereProvider extends BaseProvider {
  readonly id = "cohere";
  readonly name = "Cohere";
  readonly baseUrl = "https://api.cohere.com/compatibility/v1";

  /** Static fallback — updated dynamically by discoverModels() */
  models: ModelObject[] = [
    { id: "cohere/command-r-plus", object: "model", created: 1700000000, owned_by: "cohere", provider: "cohere" },
    { id: "cohere/command-r", object: "model", created: 1700000000, owned_by: "cohere", provider: "cohere" },
    { id: "cohere/command-a-03-2025", object: "model", created: 1700000000, owned_by: "cohere", provider: "cohere" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["COHERE_API_KEY"]);
  }

  /**
   * Discover available models from Cohere API.
   * Uses the native /v2/models endpoint (not the compat endpoint).
   */
  async discoverModels(): Promise<ModelObject[]> {
    const keys = this.getApiKeys();
    if (keys.length === 0) return this.models;

    try {
      const response = await fetch("https://api.cohere.com/v2/models?page_size=50", {
        headers: {
          Authorization: `Bearer ${keys[0]}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) return this.models;

      const data = (await response.json()) as {
        models?: Array<{ name: string; endpoints?: string[] }>;
      };

      const discovered: ModelObject[] = (data.models ?? [])
        .filter((m) => {
          // Only chat/text-generation models
          const endpoints = m.endpoints ?? [];
          const name = m.name.toLowerCase();
          return (
            (endpoints.includes("chat") || endpoints.includes("generate")) &&
            !name.includes("embed") &&
            !name.includes("rerank") &&
            !name.includes("classify")
          );
        })
        .map((m) => ({
          id: `cohere/${m.name}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: "cohere",
          provider: "cohere",
        }));

      if (discovered.length > 0) {
        this.models = discovered;
        console.log(`[Cohere] Discovered ${discovered.length} chat models`);
      }
      return this.models;
    } catch (e) {
      console.error(`[Cohere] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
