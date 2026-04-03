export interface WindowConfig {
  windowMs: number;
  maxRequests: number;
}

// Conservative free-tier defaults per provider (kept below actual limits to avoid hard 429s)
const PROVIDER_WINDOW_CONFIGS: Record<string, WindowConfig> = {
  groq:     { windowMs: 60_000, maxRequests: 28 },  // ~30 RPM free
  gemini:   { windowMs: 60_000, maxRequests: 13 },  // ~15 RPM free
  mistral:  { windowMs: 60_000, maxRequests:  4 },  // ~5 RPM free
  cerebras: { windowMs: 60_000, maxRequests: 28 },  // ~30 RPM free
  ollama:   { windowMs: 60_000, maxRequests: 999 }, // local — effectively unlimited
};

const FALLBACK_CONFIG: WindowConfig = { windowMs: 60_000, maxRequests: 10 };

interface CooldownEntry {
  blockedUntil: number;
}

export class RateLimiter {
  private cooldowns = new Map<string, CooldownEntry>();
  private windows = new Map<string, number[]>(); // per-provider request timestamps

  /** Call this every time a request is dispatched to a provider. */
  recordRequest(providerId: string): void {
    const now = Date.now();
    const cfg = PROVIDER_WINDOW_CONFIGS[providerId] ?? FALLBACK_CONFIG;
    const existing = this.windows.get(providerId) ?? [];
    // Evict expired timestamps then append
    const fresh = existing.filter((t) => now - t < cfg.windowMs);
    fresh.push(now);
    this.windows.set(providerId, fresh);
  }

  /** Returns true if the provider should be skipped (cooldown OR window full). */
  isRateLimited(providerId: string): boolean {
    // 1. Hard cooldown from an upstream 429
    const cooldown = this.cooldowns.get(providerId);
    if (cooldown) {
      if (Date.now() < cooldown.blockedUntil) return true;
      this.cooldowns.delete(providerId);
    }
    // 2. Proactive sliding-window check
    return this.isWindowFull(providerId);
  }

  private isWindowFull(providerId: string): boolean {
    const now = Date.now();
    const cfg = PROVIDER_WINDOW_CONFIGS[providerId] ?? FALLBACK_CONFIG;
    const window = this.windows.get(providerId);
    if (!window || window.length === 0) return false;
    const fresh = window.filter((t) => now - t < cfg.windowMs);
    this.windows.set(providerId, fresh);
    return fresh.length >= cfg.maxRequests;
  }

  /** Call when a provider returns 429. Sets an explicit cooldown. */
  markRateLimited(providerId: string, retryAfterSeconds?: number): void {
    const cooldownMs = retryAfterSeconds != null
      ? retryAfterSeconds * 1_000
      : 60_000;
    this.cooldowns.set(providerId, { blockedUntil: Date.now() + cooldownMs });
  }

  /** Call on successful response — clears explicit 429 cooldown. */
  clearRateLimit(providerId: string): void {
    this.cooldowns.delete(providerId);
  }

  /** Returns current sliding-window stats for observability. */
  getWindowStats(providerId: string): {
    requestsInWindow: number;
    maxRequests: number;
    windowMs: number;
    retryAfterMs: number | null;
  } {
    const now = Date.now();
    const cfg = PROVIDER_WINDOW_CONFIGS[providerId] ?? FALLBACK_CONFIG;
    const window = this.windows.get(providerId) ?? [];
    const fresh = window.filter((t) => now - t < cfg.windowMs);
    const cooldown = this.cooldowns.get(providerId);
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
