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

  // HuggingFace Router does not have a reliable API flag to distinguish
  // serverless (free) models from dedicated endpoints. Using a curated
  // static list of known-working serverless models instead of discovery.
}
