import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * Hugging Face Inference Router — free with HF token, 1000 req/5min.
 * Routes to multiple inference providers (Together, Fireworks, etc.)
 * Get a free token at: https://huggingface.co/settings/tokens
 *
 * Automatically discovers available models via /v1/models.
 */
export class HuggingFaceProvider extends BaseProvider {
  readonly id = "huggingface";
  readonly name = "Hugging Face";
  readonly baseUrl = "https://router.huggingface.co/v1";

  /** Static fallback — updated dynamically by discoverModels() */
  models: ModelObject[] = [
    { id: "huggingface/meta-llama/Llama-3.3-70B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "huggingface" },
    { id: "huggingface/Qwen/Qwen2.5-72B-Instruct", object: "model", created: 1700000000, owned_by: "alibaba", provider: "huggingface" },
    { id: "huggingface/mistralai/Mistral-7B-Instruct-v0.3", object: "model", created: 1700000000, owned_by: "mistral", provider: "huggingface" },
    { id: "huggingface/deepseek-ai/DeepSeek-R1", object: "model", created: 1700000000, owned_by: "deepseek", provider: "huggingface" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["HF_TOKEN"]);
  }

  protected override extraHeaders(): Record<string, string> {
    return { "X-Use-Cache": "0" }; // Disable HF cache for fresh responses
  }

  /**
   * Discover models from HuggingFace Router.
   * Filters to text-generation models only.
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
        data?: Array<{ id: string; owned_by?: string; pipeline_tag?: string }>;
      };

      const discovered: ModelObject[] = (data.data ?? [])
        .filter((m) => {
          // Only include text-generation models
          const tag = m.pipeline_tag ?? "";
          const id = m.id.toLowerCase();
          return (
            (tag === "text-generation" || tag === "conversational" || tag === "") &&
            !id.includes("embed") &&
            !id.includes("encoder") &&
            !id.includes("whisper") &&
            !id.includes("stable-diffusion") &&
            !id.includes("flux")
          );
        })
        .map((m) => ({
          id: `huggingface/${m.id}`,
          object: "model" as const,
          created: 1700000000,
          owned_by: m.owned_by ?? m.id.split("/")[0] ?? "unknown",
          provider: "huggingface",
        }));

      if (discovered.length > 0) {
        this.models = discovered;
        console.log(`[HuggingFace] Discovered ${discovered.length} models`);
      }
      return this.models;
    } catch (e) {
      console.error(`[HuggingFace] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
