import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * Chutes.ai — free beta tier (~200 req/day), no credit card required.
 * Access to DeepSeek, Llama, and other models during beta.
 * Get a free key at: https://chutes.ai/app/api-keys
 */
export class ChutesProvider extends BaseProvider {
  readonly id = "chutes";
  readonly name = "Chutes.ai";
  readonly baseUrl = "https://llm.chutes.ai/v1";

  readonly models: ModelObject[] = [
    { id: "chutes/deepseek-ai/DeepSeek-V3-0324", object: "model", created: 1700000000, owned_by: "deepseek", provider: "chutes" },
    { id: "chutes/deepseek-ai/DeepSeek-R1", object: "model", created: 1700000000, owned_by: "deepseek", provider: "chutes" },
    { id: "chutes/meta-llama/Llama-3.3-70B-Instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "chutes" },
    { id: "chutes/Qwen/Qwen3-235B-A22B", object: "model", created: 1700000000, owned_by: "alibaba", provider: "chutes" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["CHUTES_API_KEY"]);
  }
}
