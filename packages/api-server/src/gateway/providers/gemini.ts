import { BaseProvider } from "./base.js";
import type { ModelObject } from "../types.js";

export class GeminiProvider extends BaseProvider {
  readonly id = "gemini";
  readonly name = "Gemini";
  readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

  readonly models: ModelObject[] = [
    { id: "gemini/gemini-2.5-flash", object: "model", created: 1700000000, owned_by: "google", provider: "gemini" },
    { id: "gemini/gemini-2.5-pro", object: "model", created: 1700000000, owned_by: "google", provider: "gemini" },
    { id: "gemini/gemini-2.0-flash", object: "model", created: 1700000000, owned_by: "google", provider: "gemini" },
    { id: "gemini/gemini-2.0-flash-lite", object: "model", created: 1700000000, owned_by: "google", provider: "gemini" },
  ];

  protected getApiKey(): string | undefined {
    return process.env["GEMINI_API_KEY"];
  }


}
