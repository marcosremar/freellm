# Changelog

All notable changes to FreeLLM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-04-08

Token usage tracking — the ironic missing piece for a free-tier gateway.
Every successful request now records its `prompt_tokens` + `completion_tokens`
against a rolling 24-hour window, and the dashboard shows you exactly how much
of your free-tier budget you've burned per provider.

### Added

#### Token usage tracker
- New `UsageTracker` class tracks rolling 24-hour token totals per provider
- Hourly bucket design: O(1) writes, O(24) reads, ~576 bytes per provider max
- In-memory (rebuilt on restart, which is fine — upstream providers reset their
  daily quotas independently)

#### Per-provider usage on `/v1/status`
- New `usage` field on every `ProviderStatusInfo`:
  ```json
  {
    "promptTokens": 12345,
    "completionTokens": 6789,
    "totalTokens": 19134,
    "requestCount": 42
  }
  ```
- New gateway-wide `usage` field on `GatewayStatus` (sum across all providers)
- `POST /v1/status/providers/{id}/reset` response also includes the provider's usage

#### Request log entries carry token fields
- `RequestLogEntry` gained `promptTokens` and `completionTokens` (both optional)
- Populated automatically from `response.usage` on successful non-streaming requests

#### Dashboard: 4-card metrics row
- Added a fourth "Tokens (24h)" card (amber, with the Coins icon)
- Compact number formatter: `1234` → `1.2K`, `1500000` → `1.50M`, `2_000_000_000` → `2.00B`
- Responsive layout: 2 columns on mobile, 4 columns on desktop

#### Dashboard: per-provider token block
- Each provider card now shows a dedicated amber "TOKENS (24H)" section
- Displays total + `in X · out Y` breakdown for prompt vs completion
- Hidden on providers with zero activity so cards stay clean

#### Dashboard: Tokens column in request log
- Recent requests table added a "Tokens" column showing `prompt → completion`
- Hover tooltip shows the full breakdown
- Shows `-` for streaming requests (see limitations below)

#### Dashboard: multi-key badge (bonus)
- Provider cards now surface the `keyCount/keysAvailable` badge from v1.1.0
- Previously this data was exposed via API but not displayed in the UI
- Shows "3/4" when 3 of 4 keys are available, for example

### Limitations

- **Streaming responses don't track tokens yet.** The OpenAI SSE protocol
  doesn't guarantee a final `usage` chunk unless `stream_options.include_usage`
  is set on the request. Will be addressed in a future release.
- **No hard-coded daily quota progress bars.** Provider free tier token caps
  change often, so we show raw totals rather than stale progress indicators.

[1.2.0]: https://github.com/Devansh-365/freellm/releases/tag/v1.2.0

---

## [1.1.0] - 2026-04-08

Multi-key capacity stacking — the feature that makes FreeLLM structurally
different from every other LLM gateway. Every provider env var now accepts a
comma-separated list of API keys, and FreeLLM rotates through them with
independent per-key rate-limit budgets.

### Added

#### Multi-key rotation
- Provider env vars now accept comma-separated keys:
  `GROQ_API_KEY=key1,key2,key3` → ~84 req/min on Groq instead of 28
- Each key gets its own sliding-window rate-limit budget and cooldown state
- Round-robin rotation via `keyRotationIndex` advanced synchronously so
  concurrent requests spread across keys
- `isAvailable()` returns true when **any** key is not rate-limited —
  a single 429'd key no longer disables the whole provider
- Router only excludes a provider when **all** its keys are exhausted,
  so the next failover attempt can retry the same provider with a different key
- Circuit breaker stays provider-level (a broken baseURL affects all keys equally)

#### Per-key observability
- `GET /v1/status` now returns per-provider `keyCount`, `keysAvailable`, and
  a `keys[]` array with per-key sliding-window state
- `POST /v1/status/providers/{id}/reset` clears cooldowns on **all** keys

### Changed

- `ProviderAdapter.onSuccess` / `onRateLimit` now take the `Response` object
  so the provider can attribute events to the exact key that produced them
  via `WeakMap<Response, string>` — concurrency-safe with no race conditions
- `RateLimiter` API now keyed by tracking ID (`providerId` or `providerId#N`)
  rather than bare provider ID. Provider ID is extracted internally for
  config lookup, so the sliding-window config remains per-provider.
- Ollama uses a sentinel `["ollama"]` key to fit the uniform multi-key flow

### Migration

Fully backward compatible. Single-key configs work unchanged. To benefit from
key stacking, update any provider env var to comma-separated form:

```env
# Before
GROQ_API_KEY=gsk_single_key

# After (same behavior, still works)
GROQ_API_KEY=gsk_single_key

# After (4x free capacity)
GROQ_API_KEY=gsk_key1,gsk_key2,gsk_key3,gsk_key4
```

[1.1.0]: https://github.com/Devansh-365/freellm/releases/tag/v1.1.0

---

## [1.0.0] - 2026-04-08

First stable release. Production-ready OpenAI-compatible gateway aggregating
6 free LLM providers with automatic failover, circuit breakers, and a
real-time dashboard.

### Added

#### Gateway
- OpenAI-compatible `/v1/chat/completions` endpoint with streaming and non-streaming support
- 6 LLM providers: Groq, Gemini, Mistral, Cerebras, NVIDIA NIM, and Ollama
- 25+ models across providers including Llama 3.3 70B, Gemini 2.5 Flash/Pro, Llama 4 Scout, Qwen3, Nemotron 70B, DeepSeek R1, GPT-OSS 120B
- Three meta-models: `free` (round-robin), `free-fast` (latency-optimized), `free-smart` (capability-optimized)
- Automatic failover across providers with configurable routing strategies (round-robin, random)
- Per-provider circuit breakers with three states (closed → open → half-open) and configurable thresholds
- Per-provider sliding-window rate limiting with conservative free-tier defaults
- Per-client (per-IP) rate limiting via `express-rate-limit`
- In-memory request log (last 500 requests) with stats and recent history
- Routing deadline (`ROUTE_TIMEOUT_MS`) to prevent hung requests during cascading failures

#### Security
- Optional API key authentication (`FREELLM_API_KEY`) using timing-safe SHA-256 comparison
- Separate admin key (`FREELLM_ADMIN_KEY`) protecting circuit breaker reset and routing strategy mutations
- Configurable CORS origins (`ALLOWED_ORIGINS`)
- Body size limits on JSON and URL-encoded payloads
- Zod schema validation with strict mode and bounded `messages.max(256)` / `max_tokens.max(32768)`
- Upstream error sanitization (only safe `message` field forwarded, never raw upstream JSON)
- Production warning when running without API key auth

#### Dashboard
- React 18 + Vite + Tailwind SPA served by the same Express process in production
- Real-time provider health cards (circuit breaker state, success/failure counts, last error)
- Live request log with latency, status, model, and selected provider
- Routing strategy toggle (round-robin / random)
- Manual circuit breaker reset
- Models page with search and grouping by provider
- Mobile-responsive layout with slide-over menu
- New FreeLLM logo as favicon and Open Graph image

#### Deployment
- Multi-stage Dockerfile (Node 22 LTS, non-root `appuser`, healthcheck baked in)
- `docker-compose.yml` for one-command local deployment
- `railway.json` for Railway auto-detection with healthcheck and restart policy
- Graceful shutdown on SIGTERM/SIGINT (drains in-flight requests, 8s deadline)
- `app.set("trust proxy", 1)` for correct client IP behind reverse proxies
- Static dashboard serving with SPA fallback for client-side routing
- Production-ready logging via Pino with structured JSON output

#### Developer Experience
- pnpm workspace monorepo with shared dependency catalog
- TypeScript 5.9 across all packages with `bundler` module resolution
- esbuild bundle for the API server with CJS shim for Pino compatibility
- OpenAPI 3.1 spec as the single source of truth for the API client
- Auto-generated React Query hooks via Orval (`@workspace/api-client-react`)
- Knip configuration for unused export detection
- `scripts/test-gateway.sh` end-to-end test suite with 18 checks (health, models, status, completions, streaming, NIM direct, validation)

### Documentation
- Comprehensive README with quickstart (Docker + local), provider table, API reference, security guide, and tech stack
- Mermaid diagrams for request lifecycle, circuit breaker state machine, routing strategies, and high-level architecture
- MIT license
- Architecture refactor plan in `docs/superpowers/plans/`

[1.0.0]: https://github.com/devansh-365/freellm/releases/tag/v1.0.0
