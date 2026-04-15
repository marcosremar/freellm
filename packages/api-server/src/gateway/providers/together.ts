import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * Together AI — $25 free credits on signup, no credit card required initially.
 * Rate limits: 60 RPM on free tier.
 * Get a free key at: https://api.together.ai/settings/api-keys
 */
export class TogetherProvider extends BaseProvider {
  readonly id = "together";
  readonly name = "Together AI";
  readonly baseUrl = "https://api.together.xyz/v1";

  readonly models: ModelObject[] = [
    { id: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo", object: "model", created: 1700000000, owned_by: "meta", provider: "together" },
    { id: "together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", object: "model", created: 1700000000, owned_by: "meta", provider: "together" },
    { id: "together/Qwen/Qwen2.5-72B-Instruct-Turbo", object: "model", created: 1700000000, owned_by: "alibaba", provider: "together" },
    { id: "together/deepseek-ai/DeepSeek-V3", object: "model", created: 1700000000, owned_by: "deepseek", provider: "together" },
    { id: "together/deepseek-ai/DeepSeek-R1", object: "model", created: 1700000000, owned_by: "deepseek", provider: "together" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["TOGETHER_API_KEY"]);
  }
}
