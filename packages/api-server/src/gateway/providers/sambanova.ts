import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * SambaNova Cloud — permanent free tier, no credit card required.
 * Rate limits: 10–30 RPM depending on model.
 * Get a free key at: https://cloud.sambanova.ai/apis
 */
export class SambanovaProvider extends BaseProvider {
  readonly id = "sambanova";
  readonly name = "SambaNova";
  readonly baseUrl = "https://api.sambanova.ai/v1";

  readonly models: ModelObject[] = [
    { id: "sambanova/Meta-Llama-3.3-70B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "sambanova" },
    { id: "sambanova/Meta-Llama-3.1-405B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "sambanova" },
    { id: "sambanova/Meta-Llama-3.1-8B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "sambanova" },
    { id: "sambanova/Qwen2.5-72B-Instruct", object: "model", created: 1700000000, owned_by: "alibaba", provider: "sambanova" },
    { id: "sambanova/DeepSeek-R1", object: "model", created: 1700000000, owned_by: "deepseek", provider: "sambanova" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["SAMBANOVA_API_KEY"]);
  }
}
