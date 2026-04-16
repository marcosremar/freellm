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
   * Only includes models served by known serverless providers (not dedicated endpoints).
   * Serverless providers route requests dynamically; dedicated endpoint providers
   * (featherless-ai, scaleway, ovhcloud, replicate) require reserved capacity and fail
   * with "non-serverless" errors when accessed via the router token.
   */
  async discoverModels(): Promise<ModelObject[]> {
    const keys = this.getApiKeys();
    if (keys.length === 0) return this.models;

    // Providers known to offer serverless inference via the HF Router token
    const SERVERLESS_PROVIDERS = new Set([
      "fireworks-ai", "cerebras", "novita", "together", "fal",
      "nscale", "groq", "hyperbolic", "cohere", "zai-org",
      "sambanova", "hf-inference", "ovhcloud", "wavespeed", "nebius",
    ]);

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${keys[0]}` },
      });
      if (!response.ok) return this.models;

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          owned_by?: string;
          providers?: Array<{ provider: string; status: string }>;
          architecture?: { input_modalities?: string[]; output_modalities?: string[] };
        }>;
      };

      const discovered: ModelObject[] = (data.data ?? [])
        .filter((m) => {
          // Must have at least one live serverless provider
          const hasServerless = (m.providers ?? []).some(
            (p) => p.status === "live" && SERVERLESS_PROVIDERS.has(p.provider),
          );
          if (!hasServerless) return false;
          // Text-in / text-out only
          const inputs = m.architecture?.input_modalities ?? [];
          const outputs = m.architecture?.output_modalities ?? [];
          if (inputs.length > 0 && !inputs.includes("text")) return false;
          if (outputs.length > 0 && !outputs.includes("text")) return false;
          const id = m.id.toLowerCase();
          return !id.includes("embed") && !id.includes("whisper") &&
                 !id.includes("stable-diffusion") && !id.includes("flux");
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
        console.log(`[HuggingFace] Discovered ${discovered.length} serverless models`);
      }
      return this.models;
    } catch (e) {
      console.error(`[HuggingFace] Failed to discover models: ${e}`);
      return this.models;
    }
  }
}
