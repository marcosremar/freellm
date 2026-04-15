/**
 * Unit tests for the Hyperbolic provider.
 * No real API calls — exercises env gating, model discovery, and getBalance().
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HyperbolicProvider } from "../src/gateway/providers/hyperbolic.js";
import type { ChatCompletionRequest } from "../src/gateway/types.js";

class ExposedHyperbolic extends HyperbolicProvider {
  public exposeGetApiKeys() { return this.getApiKeys(); }
  public exposeMapRequest(r: ChatCompletionRequest) { return this.mapRequest(r); }
}

function provider() { return new ExposedHyperbolic(); }
function req(overrides: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest {
  return { model: "hyperbolic/meta-llama/Llama-3.3-70B-Instruct", messages: [{ role: "user", content: "hi" }], ...overrides };
}

let savedKey: string | undefined;
beforeEach(() => { savedKey = process.env["HYPERBOLIC_API_KEY"]; delete process.env["HYPERBOLIC_API_KEY"]; });
afterEach(() => { savedKey === undefined ? delete process.env["HYPERBOLIC_API_KEY"] : (process.env["HYPERBOLIC_API_KEY"] = savedKey); });

describe("HyperbolicProvider — env gating", () => {
  it("isEnabled() false with no key", () => expect(provider().isEnabled()).toBe(false));
  it("isEnabled() true with key set", () => {
    process.env["HYPERBOLIC_API_KEY"] = "sk_live_test";
    expect(provider().isEnabled()).toBe(true);
  });
  it("parses comma-separated keys", () => {
    process.env["HYPERBOLIC_API_KEY"] = "k1,k2";
    expect(provider().exposeGetApiKeys()).toEqual(["k1", "k2"]);
  });
});

describe("HyperbolicProvider — baseUrl & catalog", () => {
  it("uses the correct Hyperbolic API base URL", () => {
    expect(new HyperbolicProvider().baseUrl).toBe("https://api.hyperbolic.xyz/v1");
  });
  it("has at least 4 fallback models", () => {
    expect(new HyperbolicProvider().models.length).toBeGreaterThanOrEqual(4);
  });
  it("all fallback models have provider='hyperbolic'", () => {
    for (const m of new HyperbolicProvider().models) expect(m.provider).toBe("hyperbolic");
  });
  it("all fallback model IDs start with 'hyperbolic/'", () => {
    for (const m of new HyperbolicProvider().models) expect(m.id.startsWith("hyperbolic/")).toBe(true);
  });
});

describe("HyperbolicProvider — mapRequest", () => {
  it("strips 'hyperbolic/' prefix", () => {
    const mapped = provider().exposeMapRequest(req());
    expect(mapped.model).toBe("meta-llama/Llama-3.3-70B-Instruct");
  });
});

describe("HyperbolicProvider — discoverModels()", () => {
  it("returns fallback when no key", async () => {
    const p = new HyperbolicProvider();
    const fallback = [...p.models];
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });

  it("filters out image, audio, and embedding models", async () => {
    process.env["HYPERBOLIC_API_KEY"] = "sk_live_test";
    const p = new HyperbolicProvider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "meta-llama/Llama-3.3-70B-Instruct", owned_by: "meta" },
          { id: "flux-1-dev", owned_by: "blackforest" },         // image — excluded
          { id: "sdxl-turbo", owned_by: "stabilityai" },          // image — excluded
          { id: "whisper-large-v3", owned_by: "openai" },          // audio — excluded
          { id: "text-embedding-ada-002", owned_by: "openai" },    // embed — excluded
          { id: "Qwen/Qwen2.5-72B-Instruct", owned_by: "alibaba" },
        ],
      }),
    } as Response);

    const result = await p.discoverModels!();
    expect(result).toHaveLength(2);
    expect(result.map(m => m.id)).toContain("hyperbolic/meta-llama/Llama-3.3-70B-Instruct");
    expect(result.map(m => m.id)).toContain("hyperbolic/Qwen/Qwen2.5-72B-Instruct");
  });

  it("keeps fallback on API failure", async () => {
    process.env["HYPERBOLIC_API_KEY"] = "sk_live_test";
    const p = new HyperbolicProvider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));
    expect(await p.discoverModels!()).toEqual(fallback);
  });

  it("keeps fallback on non-ok HTTP response", async () => {
    process.env["HYPERBOLIC_API_KEY"] = "sk_live_test";
    const p = new HyperbolicProvider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
    expect(await p.discoverModels!()).toEqual(fallback);
  });
});

describe("HyperbolicProvider — getBalance()", () => {
  it("returns null when no key configured", async () => {
    expect(await provider().getBalance!()).toBeNull();
  });
  it("returns null (no public balance API)", async () => {
    process.env["HYPERBOLIC_API_KEY"] = "sk_live_test";
    expect(await provider().getBalance!()).toBeNull();
  });
});
