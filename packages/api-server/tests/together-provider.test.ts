/**
 * Unit tests for the Together AI provider.
 * No real API calls — exercises env gating, model discovery, and getBalance().
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TogetherProvider } from "../src/gateway/providers/together.js";
import type { ChatCompletionRequest } from "../src/gateway/types.js";

class ExposedTogether extends TogetherProvider {
  public exposeGetApiKeys() { return this.getApiKeys(); }
  public exposeMapRequest(r: ChatCompletionRequest) { return this.mapRequest(r); }
}

function provider() { return new ExposedTogether(); }
function req(overrides: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest {
  return { model: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo", messages: [{ role: "user", content: "hi" }], ...overrides };
}

let savedKey: string | undefined;
beforeEach(() => { savedKey = process.env["TOGETHER_API_KEY"]; delete process.env["TOGETHER_API_KEY"]; });
afterEach(() => { savedKey === undefined ? delete process.env["TOGETHER_API_KEY"] : (process.env["TOGETHER_API_KEY"] = savedKey); });

describe("TogetherProvider — env gating", () => {
  it("isEnabled() false with no key", () => expect(provider().isEnabled()).toBe(false));
  it("isEnabled() true with key set", () => {
    process.env["TOGETHER_API_KEY"] = "key_test";
    expect(provider().isEnabled()).toBe(true);
  });
  it("parses comma-separated keys", () => {
    process.env["TOGETHER_API_KEY"] = "k1,k2";
    expect(provider().exposeGetApiKeys()).toEqual(["k1", "k2"]);
  });
});

describe("TogetherProvider — baseUrl & catalog", () => {
  it("uses the correct Together AI base URL", () => {
    expect(new TogetherProvider().baseUrl).toBe("https://api.together.xyz/v1");
  });
  it("has at least 3 fallback models", () => {
    expect(new TogetherProvider().models.length).toBeGreaterThanOrEqual(3);
  });
  it("all fallback models have provider='together'", () => {
    for (const m of new TogetherProvider().models) expect(m.provider).toBe("together");
  });
  it("all fallback model IDs start with 'together/'", () => {
    for (const m of new TogetherProvider().models) expect(m.id.startsWith("together/")).toBe(true);
  });
});

describe("TogetherProvider — mapRequest", () => {
  it("strips 'together/' prefix", () => {
    const mapped = provider().exposeMapRequest(req());
    expect(mapped.model).toBe("meta-llama/Llama-3.3-70B-Instruct-Turbo");
  });
});

describe("TogetherProvider — discoverModels()", () => {
  it("returns fallback when no key", async () => {
    const p = new TogetherProvider();
    const fallback = [...p.models];
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });

  it("filters to production chat models (pricing > 0, type='chat'), excludes experimental (pricing=0)", async () => {
    process.env["TOGETHER_API_KEY"] = "key_test";
    const p = new TogetherProvider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", type: "chat", pricing: { input: 0.88, output: 0.88 }, organization: "meta" },
        { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", type: "chat", pricing: { input: 1.2, output: 1.2 }, organization: "Qwen" },
        { id: "Qwen/Qwen3-Coder-30B-A3B", type: "chat", pricing: { input: 0, output: 0 } },   // experimental — excluded
        { id: "embed-model", type: "embedding", pricing: { input: 0.5, output: 0 } },           // not chat — excluded
      ]),
    } as Response);

    const result = await p.discoverModels!();
    expect(result).toHaveLength(2);
    expect(result.every(m => m.id.startsWith("together/"))).toBe(true);
  });

  it("keeps fallback if API returns only experimental models (pricing=0)", async () => {
    process.env["TOGETHER_API_KEY"] = "key_test";
    const p = new TogetherProvider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: "experimental-model", type: "chat", pricing: { input: 0, output: 0 } },
      ]),
    } as Response);
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });

  it("keeps fallback on network error", async () => {
    process.env["TOGETHER_API_KEY"] = "key_test";
    const p = new TogetherProvider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });
});

describe("TogetherProvider — getBalance()", () => {
  it("returns null when no key configured", async () => {
    expect(await provider().getBalance!()).toBeNull();
  });

  it("returns null (no public balance API)", async () => {
    process.env["TOGETHER_API_KEY"] = "key_test";
    const result = await provider().getBalance!();
    expect(result).toBeNull();
  });
});
