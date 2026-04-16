/**
 * Unit tests for the HuggingFace Inference Router provider.
 * Covers env gating, serverless-provider filter in discoverModels(),
 * and static fallback behaviour.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HuggingFaceProvider } from "../src/gateway/providers/huggingface.js";

function provider() { return new HuggingFaceProvider(); }

let savedKey: string | undefined;
beforeEach(() => { savedKey = process.env["HF_TOKEN"]; delete process.env["HF_TOKEN"]; });
afterEach(() => {
  savedKey === undefined ? delete process.env["HF_TOKEN"] : (process.env["HF_TOKEN"] = savedKey);
  vi.restoreAllMocks();
});

// ─── Env gating ──────────────────────────────────────────────────────────────

describe("HuggingFaceProvider — env gating", () => {
  it("isEnabled() false with no token", () => expect(provider().isEnabled()).toBe(false));
  it("isEnabled() true when HF_TOKEN is set", () => {
    process.env["HF_TOKEN"] = "hf_test";
    expect(provider().isEnabled()).toBe(true);
  });
  it("supports comma-separated tokens", () => {
    process.env["HF_TOKEN"] = "hf_a,hf_b";
    const p = new (class extends HuggingFaceProvider {
      expose() { return this.getApiKeys(); }
    })();
    expect(p.expose()).toEqual(["hf_a", "hf_b"]);
  });
});

// ─── Static catalog ──────────────────────────────────────────────────────────

describe("HuggingFaceProvider — static catalog", () => {
  it("uses the correct router base URL", () => {
    expect(provider().baseUrl).toBe("https://router.huggingface.co/v1");
  });
  it("has at least 4 static fallback models", () => {
    expect(provider().models.length).toBeGreaterThanOrEqual(4);
  });
  it("all static models have provider='huggingface'", () => {
    for (const m of provider().models) expect(m.provider).toBe("huggingface");
  });
  it("all static model IDs start with 'huggingface/'", () => {
    for (const m of provider().models) expect(m.id.startsWith("huggingface/")).toBe(true);
  });
  it("includes meta-llama/Llama-3.3-70B-Instruct as default", () => {
    const ids = provider().models.map(m => m.id);
    expect(ids).toContain("huggingface/meta-llama/Llama-3.3-70B-Instruct");
  });
});

// ─── discoverModels() — serverless filter ────────────────────────────────────

describe("HuggingFaceProvider — discoverModels()", () => {
  it("returns static fallback when no token", async () => {
    const p = provider();
    const fallback = [...p.models];
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });

  it("keeps only models with at least one live serverless provider", async () => {
    process.env["HF_TOKEN"] = "hf_test";
    const p = provider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          // ✅ Has groq (serverless)
          {
            id: "meta-llama/Llama-3.3-70B-Instruct",
            owned_by: "meta-llama",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            providers: [
              { provider: "groq", status: "live" },
            ],
          },
          // ✅ Has fireworks-ai (serverless)
          {
            id: "Qwen/Qwen2.5-72B-Instruct",
            owned_by: "Qwen",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            providers: [
              { provider: "fireworks-ai", status: "live" },
            ],
          },
          // ❌ Only has featherless-ai (dedicated endpoint — not serverless)
          {
            id: "Hcompany/Holo3-35B-A3B",
            owned_by: "Hcompany",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            providers: [
              { provider: "featherless-ai", status: "live" },
            ],
          },
          // ❌ Only has dedicated-endpoint providers (featherless-ai, scaleway)
          {
            id: "Qwen/Qwen3-Coder-30B-A3B-Instruct",
            owned_by: "Qwen",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            providers: [
              { provider: "featherless-ai", status: "live" },
              { provider: "scaleway",       status: "live" },
            ],
          },
        ],
      }),
    } as Response);

    const result = await p.discoverModels!();
    const ids = result.map(m => m.id);
    expect(ids).toContain("huggingface/meta-llama/Llama-3.3-70B-Instruct");
    expect(ids).toContain("huggingface/Qwen/Qwen2.5-72B-Instruct");
    expect(ids).not.toContain("huggingface/Hcompany/Holo3-35B-A3B");
    expect(ids).not.toContain("huggingface/Qwen/Qwen3-Coder-30B-A3B-Instruct");
  });

  it("excludes non-text (vision/audio) models", async () => {
    process.env["HF_TOKEN"] = "hf_test";
    const p = provider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          // ❌ Image output — excluded
          {
            id: "stabilityai/stable-diffusion-xl",
            owned_by: "stabilityai",
            architecture: { input_modalities: ["text"], output_modalities: ["image"] },
            providers: [{ provider: "fireworks-ai", status: "live" }],
          },
          // ✅ Text only — included
          {
            id: "mistralai/Mistral-7B-Instruct-v0.3",
            owned_by: "mistralai",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            providers: [{ provider: "cerebras", status: "live" }],
          },
        ],
      }),
    } as Response);

    const result = await p.discoverModels!();
    const ids = result.map(m => m.id);
    expect(ids).not.toContain("huggingface/stabilityai/stable-diffusion-xl");
    expect(ids).toContain("huggingface/mistralai/Mistral-7B-Instruct-v0.3");
  });

  it("excludes providers with status != 'live'", async () => {
    process.env["HF_TOKEN"] = "hf_test";
    const p = provider();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          // ❌ groq is 'inactive', no live serverless
          {
            id: "some/model",
            owned_by: "some",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            providers: [
              { provider: "groq", status: "inactive" },
              { provider: "featherless-ai", status: "live" }, // dedicated, not serverless
            ],
          },
        ],
      }),
    } as Response);

    const result = await p.discoverModels!();
    const ids = result.map(m => m.id);
    expect(ids).not.toContain("huggingface/some/model");
  });

  it("keeps static fallback when API returns no serverless models", async () => {
    process.env["HF_TOKEN"] = "hf_test";
    const p = provider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "dedicated/only-model",
            owned_by: "dedicated",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            providers: [{ provider: "featherless-ai", status: "live" }],
          },
        ],
      }),
    } as Response);

    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });

  it("keeps static fallback on network error", async () => {
    process.env["HF_TOKEN"] = "hf_test";
    const p = provider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("network timeout"));
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });

  it("keeps static fallback when API returns non-ok response", async () => {
    process.env["HF_TOKEN"] = "hf_test";
    const p = provider();
    const fallback = [...p.models];
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    const result = await p.discoverModels!();
    expect(result).toEqual(fallback);
  });
});
