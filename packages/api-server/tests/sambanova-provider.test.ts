/**
 * Unit tests for the SambaNova Cloud provider.
 * No real API calls — exercises env gating, model catalog, and discoverModels() logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SambanovaProvider } from "../src/gateway/providers/sambanova.js";
import type { ChatCompletionRequest } from "../src/gateway/types.js";

class ExposedSambanova extends SambanovaProvider {
  public exposeGetApiKeys() { return this.getApiKeys(); }
  public exposeMapRequest(r: ChatCompletionRequest) { return this.mapRequest(r); }
}

function provider() { return new ExposedSambanova(); }
function req(overrides: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest {
  return { model: "sambanova/Meta-Llama-3.3-70B-Instruct", messages: [{ role: "user", content: "hi" }], ...overrides };
}

let savedKey: string | undefined;
beforeEach(() => { savedKey = process.env["SAMBANOVA_API_KEY"]; delete process.env["SAMBANOVA_API_KEY"]; });
afterEach(() => { savedKey === undefined ? delete process.env["SAMBANOVA_API_KEY"] : (process.env["SAMBANOVA_API_KEY"] = savedKey); });

describe("SambanovaProvider — env gating", () => {
  it("isEnabled() false with no key", () => expect(provider().isEnabled()).toBe(false));
  it("isEnabled() true with key set", () => {
    process.env["SAMBANOVA_API_KEY"] = "test-key";
    expect(provider().isEnabled()).toBe(true);
  });
  it("parses comma-separated keys", () => {
    process.env["SAMBANOVA_API_KEY"] = "k1,k2,k3";
    expect(provider().exposeGetApiKeys()).toEqual(["k1", "k2", "k3"]);
  });
  it("trims whitespace from keys", () => {
    process.env["SAMBANOVA_API_KEY"] = " k1 , k2 ";
    expect(provider().exposeGetApiKeys()).toEqual(["k1", "k2"]);
  });
});

describe("SambanovaProvider — baseUrl & catalog", () => {
  it("uses the correct SambaNova API base URL", () => {
    expect(new SambanovaProvider().baseUrl).toBe("https://api.sambanova.ai/v1");
  });
  it("has at least 4 fallback models", () => {
    expect(new SambanovaProvider().models.length).toBeGreaterThanOrEqual(4);
  });
  it("all fallback models have provider='sambanova'", () => {
    for (const m of new SambanovaProvider().models) expect(m.provider).toBe("sambanova");
  });
  it("all fallback model IDs start with 'sambanova/'", () => {
    for (const m of new SambanovaProvider().models) expect(m.id.startsWith("sambanova/")).toBe(true);
  });
});

describe("SambanovaProvider — mapRequest", () => {
  it("strips 'sambanova/' prefix from model ID", () => {
    const mapped = provider().exposeMapRequest(req());
    expect(mapped.model).toBe("Meta-Llama-3.3-70B-Instruct");
  });
  it("leaves model unchanged if no prefix", () => {
    const mapped = provider().exposeMapRequest(req({ model: "Meta-Llama-3.1-8B" }));
    expect(mapped.model).toBe("Meta-Llama-3.1-8B");
  });
  it("preserves messages and other fields", () => {
    const mapped = provider().exposeMapRequest(req({ temperature: 0.5, max_tokens: 100 }));
    expect(mapped.temperature).toBe(0.5);
    expect(mapped.max_tokens).toBe(100);
  });
});

describe("SambanovaProvider — discoverModels()", () => {
  it("returns fallback list when no key configured", async () => {
    const p = new SambanovaProvider();
    const fallback = [...p.models];
    const result = await p.discoverModels();
    expect(result).toEqual(fallback);
  });

  it("updates models from API response", async () => {
    process.env["SAMBANOVA_API_KEY"] = "test-key";
    const p = new SambanovaProvider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "Meta-Llama-3.3-70B", owned_by: "meta" },
          { id: "DeepSeek-R1", owned_by: "deepseek" },
          { id: "text-embedding-ada", owned_by: "openai" }, // should be filtered (embed)
        ],
      }),
    } as Response);

    const result = await p.discoverModels();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("sambanova/Meta-Llama-3.3-70B");
    expect(result[0].owned_by).toBe("meta");
    expect(result.every(m => !m.id.includes("embed"))).toBe(true);
  });

  it("filters out embedding models", async () => {
    process.env["SAMBANOVA_API_KEY"] = "test-key";
    const p = new SambanovaProvider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "e5-large-embed", owned_by: "huggingface" },
          { id: "llama-3.1-8b", owned_by: "meta" },
        ],
      }),
    } as Response);

    const result = await p.discoverModels();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sambanova/llama-3.1-8b");
  });

  it("keeps fallback list on API failure", async () => {
    process.env["SAMBANOVA_API_KEY"] = "test-key";
    const p = new SambanovaProvider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("network error"));
    const result = await p.discoverModels();
    expect(result).toEqual(fallback);
  });

  it("keeps fallback list on non-ok response", async () => {
    process.env["SAMBANOVA_API_KEY"] = "test-key";
    const p = new SambanovaProvider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
    const result = await p.discoverModels();
    expect(result).toEqual(fallback);
  });
});
