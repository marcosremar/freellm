/**
 * Unit tests for the sliding-window RateLimiter.
 *
 * Tests cover:
 *  - Window-based throttling (filling + clearing)
 *  - Explicit cooldown (markRateLimited / clearRateLimit)
 *  - Per-provider window configs (groq=28, mistral=4, ollama=999...)
 *  - getWindowStats() accuracy
 *  - trackingId parsing (bare "groq" vs compound "groq#0")
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { RateLimiter } from "../src/gateway/rate-limiter.js";

afterEach(() => vi.useRealTimers());

describe("RateLimiter — basic behavior", () => {
  it("is not rate-limited initially", () => {
    const rl = new RateLimiter();
    expect(rl.isRateLimited("groq#0")).toBe(false);
  });

  it("not rate-limited after requests below window limit", () => {
    const rl = new RateLimiter();
    // groq has maxRequests=28; record 27 — should still be available
    for (let i = 0; i < 27; i++) rl.recordRequest("groq#0");
    expect(rl.isRateLimited("groq#0")).toBe(false);
  });

  it("becomes rate-limited when window is full", () => {
    const rl = new RateLimiter();
    // mistral has maxRequests=4; record 4 — should be rate-limited
    for (let i = 0; i < 4; i++) rl.recordRequest("mistral#0");
    expect(rl.isRateLimited("mistral#0")).toBe(true);
  });

  it("not rate-limited for unknown provider (uses fallback of 10)", () => {
    const rl = new RateLimiter();
    for (let i = 0; i < 9; i++) rl.recordRequest("unknown_provider#0");
    expect(rl.isRateLimited("unknown_provider#0")).toBe(false);
    rl.recordRequest("unknown_provider#0"); // 10th
    expect(rl.isRateLimited("unknown_provider#0")).toBe(true);
  });
});

describe("RateLimiter — markRateLimited / clearRateLimit", () => {
  it("markRateLimited blocks the key immediately", () => {
    const rl = new RateLimiter();
    rl.markRateLimited("groq#0");
    expect(rl.isRateLimited("groq#0")).toBe(true);
  });

  it("markRateLimited with retryAfterSeconds sets correct cooldown", () => {
    vi.useFakeTimers();
    const rl = new RateLimiter();
    rl.markRateLimited("groq#0", 30); // 30 second cooldown

    expect(rl.isRateLimited("groq#0")).toBe(true);
    vi.advanceTimersByTime(29_000);
    expect(rl.isRateLimited("groq#0")).toBe(true);
    vi.advanceTimersByTime(2_000); // now past 30s
    expect(rl.isRateLimited("groq#0")).toBe(false);
  });

  it("markRateLimited with no retryAfterSeconds defaults to 60s", () => {
    vi.useFakeTimers();
    const rl = new RateLimiter();
    rl.markRateLimited("groq#0");

    vi.advanceTimersByTime(59_000);
    expect(rl.isRateLimited("groq#0")).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(rl.isRateLimited("groq#0")).toBe(false);
  });

  it("clearRateLimit removes the cooldown immediately", () => {
    const rl = new RateLimiter();
    rl.markRateLimited("groq#0", 60);
    expect(rl.isRateLimited("groq#0")).toBe(true);
    rl.clearRateLimit("groq#0");
    expect(rl.isRateLimited("groq#0")).toBe(false);
  });
});

describe("RateLimiter — sliding window expiry", () => {
  it("old requests fall out of the window over time", () => {
    vi.useFakeTimers();
    const rl = new RateLimiter();

    // Fill up mistral window (4 requests)
    for (let i = 0; i < 4; i++) rl.recordRequest("mistral#0");
    expect(rl.isRateLimited("mistral#0")).toBe(true);

    // Advance past 1 minute so the window clears
    vi.advanceTimersByTime(61_000);
    expect(rl.isRateLimited("mistral#0")).toBe(false);
  });
});

describe("RateLimiter — getWindowStats()", () => {
  it("returns correct stats for empty window", () => {
    const rl = new RateLimiter();
    const stats = rl.getWindowStats("groq#0");
    expect(stats.requestsInWindow).toBe(0);
    expect(stats.maxRequests).toBe(28); // groq limit
    expect(stats.windowMs).toBe(60_000);
    expect(stats.retryAfterMs).toBeNull();
  });

  it("counts requests in window correctly", () => {
    const rl = new RateLimiter();
    rl.recordRequest("groq#0");
    rl.recordRequest("groq#0");
    const stats = rl.getWindowStats("groq#0");
    expect(stats.requestsInWindow).toBe(2);
  });

  it("retryAfterMs is set when on cooldown", () => {
    vi.useFakeTimers();
    const rl = new RateLimiter();
    rl.markRateLimited("groq#0", 30);
    const stats = rl.getWindowStats("groq#0");
    expect(stats.retryAfterMs).toBeGreaterThan(0);
    expect(stats.retryAfterMs).toBeLessThanOrEqual(30_000);
  });

  it("retryAfterMs is null when not on cooldown", () => {
    const rl = new RateLimiter();
    const stats = rl.getWindowStats("groq#0");
    expect(stats.retryAfterMs).toBeNull();
  });
});

describe("RateLimiter — trackingId parsing", () => {
  it("bare provider ID uses the provider's window config", () => {
    const rl = new RateLimiter();
    const stats = rl.getWindowStats("groq");
    expect(stats.maxRequests).toBe(28);
  });

  it("compound trackingId (provider#key) uses the provider's window config", () => {
    const rl = new RateLimiter();
    const stats0 = rl.getWindowStats("groq#0");
    const stats1 = rl.getWindowStats("groq#1");
    expect(stats0.maxRequests).toBe(28);
    expect(stats1.maxRequests).toBe(28);
  });

  it("different key indices are tracked independently", () => {
    const rl = new RateLimiter();
    for (let i = 0; i < 4; i++) rl.recordRequest("mistral#0");
    expect(rl.isRateLimited("mistral#0")).toBe(true);
    expect(rl.isRateLimited("mistral#1")).toBe(false); // key 1 is untouched
  });
});

describe("RateLimiter — per-provider limits", () => {
  const cases: Array<[string, number]> = [
    ["groq",       28],
    ["gemini",     13],
    ["mistral",     4],
    ["cerebras",   28],
    ["openrouter", 18],
    ["sambanova",  18],
    ["together",   55],
    ["hyperbolic", 55],
    ["ollama",    999],
  ];

  for (const [provider, maxReqs] of cases) {
    it(`${provider} has maxRequests=${maxReqs}`, () => {
      const rl = new RateLimiter();
      expect(rl.getWindowStats(`${provider}#0`).maxRequests).toBe(maxReqs);
    });
  }
});
