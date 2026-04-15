import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

/**
 * DeepSeek — 5M free tokens on signup.
 * Get a free key at: https://platform.deepseek.com/api_keys
 */
export class DeepSeekProvider extends BaseProvider {
  readonly id = "deepseek";
  readonly name = "DeepSeek";
  readonly baseUrl = "https://api.deepseek.com/v1";

  readonly models: ModelObject[] = [
    { id: "deepseek/deepseek-chat", object: "model", created: 1700000000, owned_by: "deepseek", provider: "deepseek" },
    { id: "deepseek/deepseek-reasoner", object: "model", created: 1700000000, owned_by: "deepseek", provider: "deepseek" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["DEEPSEEK_API_KEY"]);
  }
}
