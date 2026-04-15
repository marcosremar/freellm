import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * Hyperbolic — free tier with 60 RPM, no credit card required.
 * Get a free key at: https://app.hyperbolic.xyz/settings
 */
export class HyperbolicProvider extends BaseProvider {
  readonly id = "hyperbolic";
  readonly name = "Hyperbolic";
  readonly baseUrl = "https://api.hyperbolic.xyz/v1";

  readonly models: ModelObject[] = [
    { id: "hyperbolic/meta-llama/Llama-3.3-70B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "hyperbolic" },
    { id: "hyperbolic/meta-llama/Meta-Llama-3.1-8B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "hyperbolic" },
    { id: "hyperbolic/Qwen/Qwen2.5-72B-Instruct", object: "model", created: 1700000000, owned_by: "alibaba", provider: "hyperbolic" },
    { id: "hyperbolic/deepseek-ai/DeepSeek-V3", object: "model", created: 1700000000, owned_by: "deepseek", provider: "hyperbolic" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["HYPERBOLIC_API_KEY"]);
  }
}
