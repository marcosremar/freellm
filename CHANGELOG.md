# Changelog

All notable changes to FreeLLM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
