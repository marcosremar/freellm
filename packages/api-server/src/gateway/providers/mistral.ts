import { BaseProvider, parseApiKeys } from "./base.js";
import type { ModelObject } from "../types.js";

export class MistralProvider extends BaseProvider {
  readonly id = "mistral";
  readonly name = "Mistral";
  readonly baseUrl = "https://api.mistral.ai/v1";

  readonly models: ModelObject[] = [
    { id: "mistral/mistral-small-latest", object: "model", created: 1700000000, owned_by: "mistral", provider: "mistral" },
    { id: "mistral/open-mistral-nemo", object: "model", created: 1700000000, owned_by: "mistral", provider: "mistral" },
    { id: "mistral/mistral-medium-latest", object: "model", created: 1700000000, owned_by: "mistral", provider: "mistral" },
  ];

  protected getApiKeys(): string[] {
    return parseApiKeys(process.env["MISTRAL_API_KEY"]);
  }
}
