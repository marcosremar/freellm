export interface WindowConfig {
  windowMs: number;
  maxRequests: number;
}

// Conservative free-tier defaults per provider (kept below actual limits to avoid hard 429s).
// These limits apply PER KEY when multiple API keys are configured for a provider.
const PROVIDER_WINDOW_CONFIGS: Record<string, WindowConfig> = {
  groq:       { windowMs: 60_000, maxRequests: 28 },  // ~30 RPM free per key
  gemini:     { windowMs: 60_000, maxRequests: 13 },  // ~15 RPM free per key
  mistral:    { windowMs: 60_000, maxRequests:  4 },  // ~5 RPM free per key
  cerebras:   { windowMs: 60_000, maxRequests: 28 },  // ~30 RPM free per key
  nim:        { windowMs: 60_000, maxRequests: 38 },  // ~40 RPM free per key
  // Cloudflare has no published RPM; it rations by Neurons per day
  // (~10k/day). 20 RPM keeps us well under any realistic burst rate
  // and lets CF's own limiter enforce the Neuron budget. On 429 we
  // honor their Retry-After.
  cloudflare: { windowMs: 60_000, maxRequests: 20 },
  // GitHub Models: low-tier allows 15 RPM/150 RPD; high-tier 10/50.
  // We pick 14 RPM (just below the low-tier cap). High-tier calls
  // will hit GitHub's 429 slightly before our cap. The daily cap is
  // NOT enforced locally; it's surfaced via GitHub's 429 with a
  // cooldown. Heavy users should stack multiple PATs.
  github:     { windowMs: 60_000, maxRequests: 14 },
  // OpenRouter free tier: 20 RPM, 50 RPD. Very aggressive limits.
  // Multiple keys help — each key gets its own 20 RPM quota.
  // The daily cap (50) is enforced upstream; we handle via 429 cooldown.
  openrouter:  { windowMs: 60_000, maxRequests: 18 },  // ~20 RPM free per key
  // SambaNova: permanent free tier, 10–30 RPM depending on model
  sambanova:   { windowMs: 60_000, maxRequests: 18 },  // ~20 RPM conservative
  // Together AI: 60 RPM on free $25 credit tier
  together:    { windowMs: 60_000, maxRequests: 55 },  // ~60 RPM
  // Hyperbolic: 60 RPM free without deposit
  hyperbolic:  { windowMs: 60_000, maxRequests: 55 },  // ~60 RPM
  // DeepSeek: 5M free tokens, no published RPM hard limit
  deepseek:    { windowMs: 60_000, maxRequests: 55 },  // conservative
  // xAI Grok: no published RPM; $25 free credits. Conservative estimate.
  xai:         { windowMs: 60_000, maxRequests: 30 },
  // HuggingFace Router: 1000 req per 5 min window = ~200 RPM effective
  huggingface: { windowMs: 60_000, maxRequests: 55 },  // ~60 RPM conservative
  // Cohere free tier: 20 RPM chat
  cohere:      { windowMs: 60_000, maxRequests: 18 },  // ~20 RPM
  // AI21: 200 RPM, 10 RPS on trial tier
  ai21:        { windowMs: 60_000, maxRequests: 55 },  // 60 RPM conservative
  ollama:      { windowMs: 60_000, maxRequests: 999 }, // local, effectively unlimited
};

const FALLBACK_CONFIG: WindowConfig = { windowMs: 60_000, maxRequests: 10 };

interface CooldownEntry {
  blockedUntil: number;
}

/**
 * Extract the provider ID from a tracking ID.
 * Tracking IDs are either bare provider IDs ("groq") or composites ("groq#0", "groq#1").
 * The config is always looked up by the bare provider ID.
 */
function getProviderId(trackingId: string): string {
  const hashIdx = trackingId.indexOf("#");
  return hashIdx === -1 ? trackingId : trackingId.substring(0, hashIdx);
}

export class RateLimiter {
  private cooldowns = new Map<string, CooldownEntry>();
  private windows = new Map<string, number[]>(); // per-key request timestamps

  /** Call every time a request is dispatched to a specific key. */
  recordRequest(trackingId: string): void {
    const now = Date.now();
    const cfg = PROVIDER_WINDOW_CONFIGS[getProviderId(trackingId)] ?? FALLBACK_CONFIG;
    const existing = this.windows.get(trackingId) ?? [];
    const fresh = existing.filter((t) => now - t < cfg.windowMs);
    fresh.push(now);
    this.windows.set(trackingId, fresh);
  }

  /** Returns true if the key should be skipped (cooldown OR window full). */
  isRateLimited(trackingId: string): boolean {
    const cooldown = this.cooldowns.get(trackingId);
    if (cooldown) {
      if (Date.now() < cooldown.blockedUntil) return true;
      this.cooldowns.delete(trackingId);
    }
    return this.isWindowFull(trackingId);
  }

  private isWindowFull(trackingId: string): boolean {
    const now = Date.now();
    const cfg = PROVIDER_WINDOW_CONFIGS[getProviderId(trackingId)] ?? FALLBACK_CONFIG;
    const window = this.windows.get(trackingId);
    if (!window || window.length === 0) return false;
    const fresh = window.filter((t) => now - t < cfg.windowMs);
    this.windows.set(trackingId, fresh);
    return fresh.length >= cfg.maxRequests;
  }

  /** Call when a specific key receives an upstream 429. */
  markRateLimited(trackingId: string, retryAfterSeconds?: number): void {
    const cooldownMs = retryAfterSeconds != null
      ? retryAfterSeconds * 1_000
      : 60_000;
    this.cooldowns.set(trackingId, { blockedUntil: Date.now() + cooldownMs });
  }

  /** Call on successful response — clears the explicit cooldown for that key. */
  clearRateLimit(trackingId: string): void {
    this.cooldowns.delete(trackingId);
  }

  /** Returns current sliding-window stats for a specific key. */
  getWindowStats(trackingId: string): {
    requestsInWindow: number;
    maxRequests: number;
    windowMs: number;
    retryAfterMs: number | null;
  } {
    const now = Date.now();
    const cfg = PROVIDER_WINDOW_CONFIGS[getProviderId(trackingId)] ?? FALLBACK_CONFIG;
    const window = this.windows.get(trackingId) ?? [];
    const fresh = window.filter((t) => now - t < cfg.windowMs);
    const cooldown = this.cooldowns.get(trackingId);
    const retryAfterMs =
      cooldown && now < cooldown.blockedUntil ? cooldown.blockedUntil - now : null;
    return {
      requestsInWindow: fresh.length,
      maxRequests: cfg.maxRequests,
      windowMs: cfg.windowMs,
      retryAfterMs,
    };
  }
}
