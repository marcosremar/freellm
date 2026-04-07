import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

export class NimProvider extends BaseProvider {
  readonly id = "nim";
  readonly name = "NVIDIA NIM";
  readonly baseUrl = "https://integrate.api.nvidia.com/v1";

  readonly models: ModelObject[] = [
    { id: "nim/meta/llama-3.3-70b-instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "nim" },
    { id: "nim/meta/llama-3.1-405b-instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "nim" },
    { id: "nim/meta/llama-3.1-70b-instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "nim" },
    { id: "nim/meta/llama-3.1-8b-instruct", object: "model", created: 1700000000, owned_by: "meta", provider: "nim" },
    { id: "nim/nvidia/llama-3.1-nemotron-70b-instruct", object: "model", created: 1700000000, owned_by: "nvidia", provider: "nim" },
    { id: "nim/mistralai/mixtral-8x22b-instruct-v0.1", object: "model", created: 1700000000, owned_by: "mistral", provider: "nim" },
    { id: "nim/deepseek-ai/deepseek-r1", object: "model", created: 1700000000, owned_by: "deepseek", provider: "nim" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["NVIDIA_NIM_API_KEY"]);
  }
}
