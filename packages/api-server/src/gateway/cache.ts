import { createHash } from "crypto";
import type { ChatCompletionRequest, ChatCompletionResponse } from "./types.js";

/**
 * In-memory LRU cache for OpenAI-compatible chat completions.
 *
 * Design:
 * - Exact-match keying via sha256(model, messages, temperature, max_tokens, top_p, stop)
 * - LRU eviction: re-insert on read keeps recently-used entries at the end of the Map
 * - TTL expiry per entry (Date.now() + ttlMs)
 * - Streaming responses are never cached (the protocol is incompatible)
 * - Errors are never cached (only successful responses)
 *
 * The whole thing lives in process memory because the rest of FreeLLM's
 * observability state (request log, rate limiter, circuit breaker, usage
 * tracker) is also in-memory. Restart resets everything together — consistent.
 *
 * Memory math: ~5-50KB per cached response × 1000 entries = ~5-50MB max.
 * Configurable via CACHE_MAX_ENTRIES if needed.
 */

export interface CacheStats {
  enabled: boolean;
  ttlMs: number;
  maxEntries: number;
  currentSize: number;
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  hitRate: number;
}

interface CacheEntry {
  /** The cached response (deep-cloned at set/get to avoid mutation bugs). */
  response: ChatCompletionResponse;
  /** Provider that originally produced this response. */
  provider: string;
  /** When this entry expires (Date.now() ms). */
  expiresAt: number;
  /** When this entry was first written. */
  createdAt: number;
  /** How many times this entry has been served from cache. */
  hitCount: number;
  /** Token usage from the original response (not double-counted on hits). */
  promptTokens: number;
  completionTokens: number;
}

export class ResponseCache {
  private store = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly enabled: boolean;

  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;

  constructor() {
    // CACHE_ENABLED: defaults to "true". Set to "false" to disable.
    this.enabled = (process.env["CACHE_ENABLED"] ?? "true").toLowerCase() !== "false";
    // CACHE_TTL_MS: defaults to 1 hour.
    this.ttlMs = parseInt(process.env["CACHE_TTL_MS"] ?? "3600000", 10);
    // CACHE_MAX_ENTRIES: defaults to 1000.
    this.maxEntries = parseInt(process.env["CACHE_MAX_ENTRIES"] ?? "1000", 10);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Build a cache key from the parameters that affect the response.
   * Order-stable JSON keeps the hash deterministic across calls.
   */
  private buildKey(request: ChatCompletionRequest): string {
    const normalized = JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? null,
      max_tokens: request.max_tokens ?? null,
      top_p: request.top_p ?? null,
      stop: request.stop ?? null,
    });
    return createHash("sha256").update(normalized).digest("hex");
  }

  /**
   * Look up a cached response. Returns undefined on miss/expired/disabled/streaming.
   * Successful hits are re-inserted to bump them to the end of the LRU order.
   */
  get(request: ChatCompletionRequest): {
    response: ChatCompletionResponse;
    provider: string;
    promptTokens: number;
    completionTokens: number;
  } | undefined {
    if (!this.enabled) return undefined;
    if (request.stream) return undefined;

    const key = this.buildKey(request);
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    // LRU bump: re-insert to mark as recently used.
    this.store.delete(key);
    this.store.set(key, entry);

    entry.hitCount++;
    this.hits++;

    return {
      response: entry.response,
      provider: entry.provider,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
    };
  }

  /**
   * Store a successful response. Skips streaming and disabled cache.
   * Evicts the oldest entry if at capacity (LRU).
   */
  set(
    request: ChatCompletionRequest,
    response: ChatCompletionResponse,
    provider: string,
    promptTokens: number,
    completionTokens: number,
  ): void {
    if (!this.enabled) return;
    if (request.stream) return;

    const key = this.buildKey(request);

    // LRU eviction if over capacity AND this is a new key
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
        this.evictions++;
      }
    }

    this.store.set(key, {
      response,
      provider,
      promptTokens,
      completionTokens,
      expiresAt: Date.now() + this.ttlMs,
      createdAt: Date.now(),
      hitCount: 0,
    });
    this.sets++;
  }

  /** Clear all cached entries (admin reset). */
  clear(): void {
    this.store.clear();
  }

  /** Snapshot of cache statistics for /v1/status and the dashboard. */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      enabled: this.enabled,
      ttlMs: this.ttlMs,
      maxEntries: this.maxEntries,
      currentSize: this.store.size,
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}
