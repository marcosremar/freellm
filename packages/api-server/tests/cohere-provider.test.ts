/**
 * Unit tests for the Cohere provider.
 * Covers env gating, model catalog, discoverModels(), and request mapping.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CohereProvider } from "../src/gateway/providers/cohere.js";
import type { ChatCompletionRequest } from "../src/gateway/types.js";

class ExposedCohere extends CohereProvider {
  public exposeGetApiKeys() { return this.getApiKeys(); }
  public exposeMapRequest(r: ChatCompletionRequest) { return this.mapRequest(r); }
}

function provider() { return new ExposedCohere(); }

let savedKey: string | undefined;
beforeEach(() => { savedKey = process.env["COHERE_API_KEY"]; delete process.env["COHERE_API_KEY"]; });
afterEach(() => {
  savedKey === undefined ? delete process.env["COHERE_API_KEY"] : (process.env["COHERE_API_KEY"] = savedKey);
  vi.restoreAllMocks();
});

describe("CohereProvider — env gating", () => {
  it("isEnabled() false with no key", () => expect(provider().isEnabled()).toBe(false));
  it("isEnabled() true when COHERE_API_KEY is set", () => {
    process.env["COHERE_API_KEY"] = "key_test";
    expect(provider().isEnabled()).toBe(true);
  });
  it("parses comma-separated keys", () => {
    process.env["COHERE_API_KEY"] = "k1,k2";
    expect(provider().exposeGetApiKeys()).toEqual(["k1", "k2"]);
  });
});

describe("CohereProvider — catalog", () => {
  it("uses Cohere v2 chat endpoint", () => {
    expect(new CohereProvider().baseUrl).toContain("cohere");
  });
  it("has at least 2 fallback models", () => {
    expect(new CohereProvider().models.length).toBeGreaterThanOrEqual(2);
  });
  it("all models have provider='cohere'", () => {
    for (const m of new CohereProvider().models) expect(m.provider).toBe("cohere");
  });
  it("all model IDs start with 'cohere/'", () => {
    for (const m of new CohereProvider().models) expect(m.id.startsWith("cohere/")).toBe(true);
  });
  it("includes command-r-plus as default model", () => {
    const ids = new CohereProvider().models.map(m => m.id);
    expect(ids.some(id => id.includes("command-r"))).toBe(true);
  });
});

describe("CohereProvider — discoverModels()", () => {
  it("returns fallback when no key", async () => {
    const p = new CohereProvider();
    const fallback = [...p.models];
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });

  it("discovers chat models from API", async () => {
    process.env["COHERE_API_KEY"] = "key_test";
    const p = new CohereProvider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: "command-r-plus", endpoints: ["chat"] },
          { name: "command-r",      endpoints: ["chat", "embed"] },
          { name: "embed-english",  endpoints: ["embed"] }, // excluded — no chat
        ],
      }),
    } as Response);

    const result = await p.discoverModels!();
    const ids = result.map(m => m.id);
    expect(ids).toContain("cohere/command-r-plus");
    expect(ids).toContain("cohere/command-r");
    expect(ids).not.toContain("cohere/embed-english");
  });

  it("keeps fallback on API error", async () => {
    process.env["COHERE_API_KEY"] = "key_test";
    const p = new CohereProvider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));
    expect(await p.discoverModels!()).toEqual(fallback);
  });
});

describe("CohereProvider — mapRequest", () => {
  it("strips 'cohere/' prefix from model name", () => {
    process.env["COHERE_API_KEY"] = "key_test";
    const mapped = provider().exposeMapRequest({
      model: "cohere/command-r-plus",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(mapped.model).toBe("command-r-plus");
  });
});
