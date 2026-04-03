<div align="center">

# FreeLLM

**One endpoint. Every free LLM.**

An OpenAI-compatible gateway that aggregates free-tier AI providers into a single, reliable API with automatic failover, rate-limit awareness, and a real-time dashboard.

[Quickstart](#quickstart) &bull; [API Reference](#api-reference) &bull; [Dashboard](#dashboard) &bull; [Architecture](#architecture)

---

</div>

## Why FreeLLM?

Every major LLM provider offers a free tier -- but each one has tight rate limits, different SDKs, and occasional downtime. FreeLLM sits in front of all of them and gives you:

- **A single OpenAI-compatible endpoint** -- drop it into any app that speaks OpenAI
- **Automatic failover** -- if Groq is rate-limited, the request silently routes to Gemini, Mistral, or others
- **Smart routing** -- choose `free-fast` for speed or `free-smart` for capability
- **Zero cost** -- every provider used is on its free tier

## Supported Providers

| Provider | Models | Free RPM | Strengths |
|----------|--------|----------|-----------|
| **Groq** | Llama 3.3 70B, Llama 3.1 8B, Gemma2, Mixtral | ~30 | Ultra-low latency |
| **Gemini** | Gemini 2.0 Flash, 1.5 Flash, 1.5 Pro | ~15 | High capability |
| **Mistral** | Mistral Small | ~5 | Strong reasoning |
| **Cerebras** | Llama 3.3 70B | ~30 | Fast inference |
| **Ollama** | Any local model | Unlimited | Privacy, no rate limits |

## Quickstart

### 1. Clone & install

```bash
git clone https://github.com/devanshtiwari/freellm.git
cd freellm
pnpm install
```

### 2. Configure API keys

```bash
cp .env.example .env
```

Add at least one provider key. More keys = better availability:

```env
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...
MISTRAL_API_KEY=...
CEREBRAS_API_KEY=...
```

### 3. Start the server

```bash
pnpm dev
```

The API starts on `http://localhost:3000` and the dashboard on `http://localhost:5173`.

### 4. Make a request

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "free-fast",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Or use any OpenAI-compatible SDK:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="unused")

response = client.chat.completions.create(
    model="free-smart",
    messages=[{"role": "user", "content": "Explain quantum computing in one paragraph."}]
)

print(response.choices[0].message.content)
```

```typescript
import OpenAI from "openai";

const client = new OpenAI({ baseURL: "http://localhost:3000/v1", apiKey: "unused" });

const response = await client.chat.completions.create({
  model: "free-fast",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Meta-Models

Instead of picking a specific provider, use a meta-model and let FreeLLM route for you:

| Model | Behavior | Best For |
|-------|----------|----------|
| `free` | Round-robin across all available providers | General use, maximum availability |
| `free-fast` | Prioritizes low-latency providers (Groq > Cerebras > Gemini) | Chatbots, real-time apps |
| `free-smart` | Prioritizes capable models (Gemini > Groq > Mistral) | Complex reasoning, analysis |

You can also target a specific provider model directly:

```
groq/llama-3.3-70b-versatile
gemini/gemini-2.0-flash
mistral/mistral-small-latest
```

## API Reference

FreeLLM exposes an OpenAI-compatible API. All endpoints are available at both `/v1/...` (direct) and `/api/v1/...` (dashboard proxy).

### Chat Completions

```
POST /v1/chat/completions
```

Supports both streaming (`"stream": true`) and non-streaming responses. The response includes an `x_freellm_provider` field indicating which provider handled the request.

### List Models

```
GET /v1/models
```

Returns all available models across configured providers, plus the three meta-models.

### Gateway Status

```
GET  /v1/status                              # Full gateway status & metrics
POST /v1/status/providers/{id}/reset         # Reset a provider's circuit breaker
PATCH /v1/status/routing                     # Switch routing strategy
```

## Dashboard

The built-in dashboard provides real-time visibility into gateway health:

- **Provider health cards** -- circuit breaker state, success/failure counts, last error
- **Request log** -- recent requests with latency, status, and provider used
- **Routing control** -- toggle between round-robin and random strategies
- **Circuit breaker reset** -- manually recover a tripped provider

## Architecture

```
packages/
  api-server/          Express 5 + TypeScript API
    src/
      gateway/
        config.ts        Meta-models, priorities, defaults (single source of truth)
        router.ts        Failover loop with round-robin/random strategies
        registry.ts      Provider management
        circuit-breaker.ts   Per-provider health (closed/open/half-open)
        rate-limiter.ts      Sliding window + cooldown tracking
        providers/       One adapter per provider (Groq, Gemini, Mistral, Cerebras, Ollama)
      middleware/
        error-handler.ts   Centralized Express error handling
        validate.ts        Zod schema validation middleware
      routes/
        v1/              OpenAI-compatible endpoints

  dashboard/           React + Vite + Tailwind SPA
    src/
      components/      Extracted, focused UI components
      pages/           Dashboard, Models, Quickstart

lib/
  api-spec/            OpenAPI 3.1 specification (source of truth)
  api-client-react/    Auto-generated React hooks (via Orval)
```

### How Routing Works

```
Request ──> Pick provider (round-robin / random)
              │
              ├── 200 OK ──> Return response, mark provider healthy
              │
              ├── 429 ──> Mark rate-limited, try next provider
              │
              ├── 5xx ──> Trip circuit breaker, try next provider
              │
              ├── 400/401/403/404 ──> Non-retriable, return error immediately
              │
              └── All exhausted ──> Return 429 "all_providers_exhausted"
```

### Circuit Breaker States

```
CLOSED (healthy) ──3 failures──> OPEN (blocked) ──30s timeout──> HALF-OPEN (testing)
       ^                                                              │
       └──────────── 2 successes ─────────────────────────────────────┘
```

Configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CB_FAILURE_THRESHOLD` | `3` | Failures before tripping open |
| `CB_SUCCESS_THRESHOLD` | `2` | Successes in half-open before closing |
| `CB_TIMEOUT_MS` | `30000` | Time before open transitions to half-open |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9 |
| API | Express 5 |
| Validation | Zod |
| Frontend | React 18 + Vite |
| UI | Radix UI + Tailwind CSS |
| State | TanStack Query |
| Logging | Pino |
| API Codegen | Orval (from OpenAPI spec) |

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Commit (`git commit -m "feat: add my feature"`)
5. Push and open a PR

## License

MIT
