/**
 * Unit tests for the AI21 Labs provider.
 * Covers env gating, Jamba model catalog, and discoverModels().
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Ai21Provider } from "../src/gateway/providers/ai21.js";
import type { ChatCompletionRequest } from "../src/gateway/types.js";

class ExposedAi21 extends Ai21Provider {
  public exposeGetApiKeys() { return this.getApiKeys(); }
  public exposeMapRequest(r: ChatCompletionRequest) { return this.mapRequest(r); }
}

function provider() { return new ExposedAi21(); }

let savedKey: string | undefined;
beforeEach(() => { savedKey = process.env["AI21_API_KEY"]; delete process.env["AI21_API_KEY"]; });
afterEach(() => {
  savedKey === undefined ? delete process.env["AI21_API_KEY"] : (process.env["AI21_API_KEY"] = savedKey);
  vi.restoreAllMocks();
});

describe("Ai21Provider — env gating", () => {
  it("isEnabled() false with no key", () => expect(provider().isEnabled()).toBe(false));
  it("isEnabled() true when AI21_API_KEY is set", () => {
    process.env["AI21_API_KEY"] = "key_test";
    expect(provider().isEnabled()).toBe(true);
  });
  it("parses comma-separated keys", () => {
    process.env["AI21_API_KEY"] = "k1,k2";
    expect(provider().exposeGetApiKeys()).toEqual(["k1", "k2"]);
  });
});

describe("Ai21Provider — catalog", () => {
  it("uses the AI21 API base URL", () => {
    expect(new Ai21Provider().baseUrl).toContain("ai21");
  });
  it("has at least 2 Jamba fallback models", () => {
    expect(new Ai21Provider().models.length).toBeGreaterThanOrEqual(2);
  });
  it("all models have provider='ai21'", () => {
    for (const m of new Ai21Provider().models) expect(m.provider).toBe("ai21");
  });
  it("all model IDs start with 'ai21/'", () => {
    for (const m of new Ai21Provider().models) expect(m.id.startsWith("ai21/")).toBe(true);
  });
  it("includes jamba models", () => {
    const ids = new Ai21Provider().models.map(m => m.id);
    expect(ids.some(id => id.toLowerCase().includes("jamba"))).toBe(true);
  });
});

describe("Ai21Provider — discoverModels()", () => {
  it("returns fallback when no key", async () => {
    const p = new Ai21Provider();
    const fallback = [...p.models];
    expect(await p.discoverModels!()).toEqual(fallback);
  });

  it("discovers models from AI21 API", async () => {
    process.env["AI21_API_KEY"] = "key_test";
    const p = new Ai21Provider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: "jamba-mini-1.6",  name: "Jamba Mini 1.6" },
        { id: "jamba-large-1.6", name: "Jamba Large 1.6" },
      ]),
    } as Response);

    const result = await p.discoverModels!();
    const ids = result.map(m => m.id);
    expect(ids).toContain("ai21/jamba-mini-1.6");
    expect(ids).toContain("ai21/jamba-large-1.6");
  });

  it("keeps fallback on network error", async () => {
    process.env["AI21_API_KEY"] = "key_test";
    const p = new Ai21Provider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));
    expect(await p.discoverModels!()).toEqual(fallback);
  });
});

describe("Ai21Provider — mapRequest", () => {
  it("strips 'ai21/' prefix from model name", () => {
    process.env["AI21_API_KEY"] = "key_test";
    const mapped = provider().exposeMapRequest({
      model: "ai21/jamba-mini-1.6",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(mapped.model).toBe("jamba-mini-1.6");
  });
});
