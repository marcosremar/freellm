<div align="center">

# FreeLLM

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Providers](https://img.shields.io/badge/Providers-6-blueviolet?style=flat-square)
![Models](https://img.shields.io/badge/Models-25+-orange?style=flat-square)

### Stop juggling API keys. Start shipping.

One endpoint, 6 providers, 25+ models -- all free.
FreeLLM is an OpenAI-compatible gateway that routes your requests across
Groq, Gemini, Mistral, Cerebras, NVIDIA NIM, and Ollama so you never hit a rate limit again.

[Quickstart](#quickstart) · [How It Works](#how-it-works) · [API](#api-reference) · [Dashboard](#dashboard) · [Architecture](#architecture)

---

![FreeLLM Dashboard](docs/screenshots/dashboard.png)

</div>

## The Problem

You want to use LLMs in your project without paying. Every major provider has a free tier -- but each comes with its own SDK, its own rate limits, and its own downtime. You end up writing provider-switching logic, handling 429s, and babysitting API keys across five different dashboards.

**FreeLLM fixes this in one line:**

```bash
curl http://localhost:3000/v1/chat/completions \
  -d '{"model": "free-fast", "messages": [{"role": "user", "content": "Hello!"}]}'
```

Your request goes to the fastest available provider. If that provider is rate-limited or down, FreeLLM tries the next one. You get a response. Every time.

## What You Get

- **One endpoint, any OpenAI SDK** -- swap your base URL, keep your existing code
- **Automatic failover** -- Groq rate-limited? Your request silently routes to Gemini, then Mistral, then Cerebras
- **Smart meta-models** -- `free-fast` for speed, `free-smart` for capability, `free` for maximum availability
- **Built-in rate-limit tracking** -- FreeLLM knows each provider's limits and avoids hitting them
- **Circuit breakers** -- failing providers get taken out of rotation and tested for recovery automatically
- **Real-time dashboard** -- see provider health, request logs, and latency at a glance
- **Zero cost** -- every provider runs on its free tier

## Supported Providers

| Provider | Models | Free Tier | Why It's Here |
|----------|--------|-----------|---------------|
| **Groq** | Llama 3.3 70B, Llama 3.1 8B, Llama 4 Scout, Qwen3 32B | ~30 req/min | Fastest inference available |
| **Gemini** | Gemini 2.5 Flash, 2.5 Pro, 2.0 Flash, 2.0 Flash Lite | ~15 req/min | Most capable free models |
| **Mistral** | Mistral Small, Mistral Medium, Mistral Nemo | ~5 req/min | Strong reasoning at low cost |
| **Cerebras** | Llama 3.1 8B, Qwen3 235B, GPT-OSS 120B | ~30 req/min | High-throughput inference |
| **NVIDIA NIM** | Llama 3.3 70B, Llama 3.1 405B, Nemotron 70B, Mixtral 8x22B, DeepSeek R1 | ~40 req/min | Frontier models on DGX Cloud |
| **Ollama** | Any local model | Unlimited | Your hardware, your rules |

**Combined free capacity: ~120 requests/minute** across all cloud providers -- enough for prototyping, internal tools, and side projects.

> Get free API keys from each provider:
> [Groq](https://console.groq.com), [Gemini](https://aistudio.google.com), [Mistral](https://console.mistral.ai), [Cerebras](https://cloud.cerebras.ai), [NVIDIA NIM](https://build.nvidia.com)

## Quickstart

### Option A: Docker (recommended)

```bash
git clone https://github.com/devanshtiwari/freellm.git
cd freellm
cp .env.example .env        # add your API keys
docker compose up
```

API runs on `http://localhost:3000`. Done.

### Option B: Local

#### 1. Clone and install

```bash
git clone https://github.com/devanshtiwari/freellm.git
cd freellm
pnpm install
```

#### 2. Add your API keys

```bash
cp .env.example .env
```

Open `.env` and paste at least one key. More keys = more availability:

```env
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...
MISTRAL_API_KEY=...
CEREBRAS_API_KEY=...
NVIDIA_NIM_API_KEY=nvapi-...
```

#### 3. Start

```bash
pnpm dev
```

API runs on `http://localhost:3000`. Dashboard on `http://localhost:5173`.

Point any OpenAI-compatible SDK at `http://localhost:3000/v1` and go.

### Use with Python

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="unused")

response = client.chat.completions.create(
    model="free-smart",
    messages=[{"role": "user", "content": "Explain quantum computing in one paragraph."}]
)

print(response.choices[0].message.content)
```

### Use with TypeScript

```typescript
import OpenAI from "openai";

const client = new OpenAI({ baseURL: "http://localhost:3000/v1", apiKey: "unused" });

const response = await client.chat.completions.create({
  model: "free-fast",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Use with curl

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "free",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## How It Works

### Meta-Models

Don't pick a provider. Pick a strategy:

| Model | What It Does | Use When |
|-------|-------------|----------|
| `free` | Rotates across all available providers evenly | You want maximum uptime |
| `free-fast` | Routes to the lowest-latency provider first (Groq > Cerebras > Gemini > NIM) | You're building a chatbot or real-time UI |
| `free-smart` | Routes to the most capable model first (Gemini > NIM > Groq > Mistral) | You need stronger reasoning or longer context |

Need a specific model? Target it directly:

```
groq/llama-3.3-70b-versatile
gemini/gemini-2.5-flash
mistral/mistral-small-latest
cerebras/llama3.1-8b
nim/meta/llama-3.3-70b-instruct
nim/nvidia/llama-3.1-nemotron-70b-instruct
nim/deepseek-ai/deepseek-r1
```

### Request Lifecycle

The complete journey of a request through the gateway:

```mermaid
flowchart TB
    Client([Client / OpenAI SDK]) -->|HTTP Request| CORS[CORS Filter]
    CORS --> RL[Per-Client Rate Limiter]
    RL -->|Exceeded| R429_1[429 Rate Limited]
    RL -->|OK| Auth[API Key Auth]
    Auth -->|Invalid| R401[401 Unauthorized]
    Auth -->|Valid / No key set| Router[Express Router]
    
    Router -->|/healthz| Health[200 OK]
    Router -->|/v1/models| Models[List Models]
    Router -->|/v1/status| Status[Gateway Status]
    Router -->|/v1/chat/completions| Validate[Zod Validation]
    
    Validate -->|Invalid| R400[400 Bad Request]
    Validate -->|Valid| Stream{stream?}
    
    Stream -->|false| GW[Gateway Router]
    Stream -->|true| GWS[Gateway Router]
    
    GW --> Pick
    GWS --> Pick

    subgraph Gateway["Gateway Failover Loop"]
        Pick[Pick Provider] --> CB{Circuit Breaker}
        CB -->|Open| Exclude[Exclude Provider]
        CB -->|Closed / Half-Open| RateCheck{Rate Limited?}
        RateCheck -->|Yes| Exclude
        RateCheck -->|No| Send[Send to Provider]
        Send -->|200 OK| Success[Mark Healthy]
        Send -->|429| OnRL[Mark Rate Limited]
        OnRL --> Exclude
        Send -->|5xx| OnErr[Trip Breaker]
        OnErr --> Exclude
        Send -->|4xx| ClientErr[Return Error]
        Exclude --> More{More Providers?}
        More -->|Yes| Pick
        More -->|No| Exhausted[All Exhausted]
    end
    
    Success -->|Non-streaming| JSON[JSON Response]
    Success -->|Streaming| SSE[SSE Stream]
    Exhausted --> R429_2[429 All Providers Exhausted]
    ClientErr --> R4xx[4xx Provider Error]
    
    JSON --> Client
    SSE --> Client
```

### Circuit Breaker States

Each provider has an independent circuit breaker that protects against cascading failures:

```mermaid
stateDiagram-v2
    [*] --> Closed
    
    Closed --> Open : 3 consecutive failures
    Open --> HalfOpen : 30s timeout expires
    HalfOpen --> Closed : 2 successes
    HalfOpen --> Open : Any failure
    
    Closed --> Closed : Success (reset counter)
    Open --> Open : Requests blocked

    state Closed {
        [*] : Requests flow normally
    }
    state Open {
        [*] : All requests rejected
    }
    state HalfOpen {
        [*] : Testing with limited requests
    }
```

### Routing and Failover

```mermaid
flowchart LR
    subgraph Meta-Models
        Free[free] -->|Round-robin| All[All Providers]
        Fast[free-fast] -->|Priority| FastOrder[Groq → Cerebras → Gemini → NIM → Mistral → Ollama]
        Smart[free-smart] -->|Priority| SmartOrder[Gemini → NIM → Groq → Mistral → Cerebras → Ollama]
    end
```

All thresholds are configurable:

| Variable | Default | What It Controls |
|----------|---------|-----------------|
| `CB_FAILURE_THRESHOLD` | `3` | Consecutive failures before tripping open |
| `CB_SUCCESS_THRESHOLD` | `2` | Successes needed in half-open to recover |
| `CB_TIMEOUT_MS` | `30000` | Wait time before testing an open breaker |

### Securing Your Gateway

Both settings are optional. Leave them empty for local development.

| Variable | What It Does |
|----------|-------------|
| `FREELLM_API_KEY` | When set, every request must include `Authorization: Bearer <key>`. Prevents unauthorized use of your gateway. |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://myapp.com,https://admin.myapp.com`). When empty, all origins are allowed. |

**For production deployments**, set both:

```env
FREELLM_API_KEY=some-secret-key-here
ALLOWED_ORIGINS=https://myapp.com
```

Then pass your key in requests:

```bash
curl http://your-server.com/v1/chat/completions \
  -H "Authorization: Bearer some-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model": "free-fast", "messages": [{"role": "user", "content": "Hello!"}]}'
```

## API Reference

Fully OpenAI-compatible. Available at `/v1/...` (direct) and `/api/v1/...` (proxied via dashboard).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | Chat completion (streaming and non-streaming) |
| `GET` | `/v1/models` | List all available models + meta-models |
| `GET` | `/v1/status` | Gateway health, provider states, recent requests |
| `POST` | `/v1/status/providers/{id}/reset` | Force-reset a provider's circuit breaker |
| `PATCH` | `/v1/status/routing` | Switch between `round_robin` and `random` |

Every response includes an `x_freellm_provider` header so you know which provider handled it.

## Dashboard

A built-in web UI for monitoring your gateway in real time:

- **Provider health** -- see which providers are healthy, rate-limited, or failing
- **Live request log** -- every request with its model, provider, latency, and status
- **Routing controls** -- switch strategies without restarting the server
- **Circuit breaker management** -- manually reset a tripped provider when you know it's back

![Models Page](docs/screenshots/models.png)

## Architecture

```mermaid
graph TB
    subgraph Client Layer
        SDK([OpenAI SDK / curl])
        Dashboard([Dashboard SPA])
    end

    subgraph API Server ["API Server (Express 5)"]
        direction TB
        MW["Middleware Stack<br/>CORS → Rate Limit → Auth → Body Parser"]
        
        subgraph Routes
            Health["/healthz"]
            Chat["/v1/chat/completions"]
            ModelsRoute["/v1/models"]
            StatusRoute["/v1/status"]
        end
        
        subgraph Gateway
            GWRouter["Gateway Router<br/>Failover + Strategy"]
            Registry["Provider Registry"]
            CB["Circuit Breakers<br/>(per provider)"]
            RateLim["Rate Limiters<br/>(per provider)"]
            ReqLog["Request Log<br/>(in-memory, 500 max)"]
        end
        
        ErrHandler["Error Handler"]
    end

    subgraph Providers ["LLM Providers"]
        Groq([Groq])
        Gemini([Gemini])
        Mistral([Mistral])
        Cerebras([Cerebras])
        NIM([NVIDIA NIM])
        Ollama([Ollama])
    end

    SDK --> MW
    Dashboard --> MW
    MW --> Routes
    Chat --> GWRouter
    GWRouter --> Registry
    Registry --> CB
    Registry --> RateLim
    GWRouter --> Providers
    GWRouter --> ReqLog
    GWRouter --> ErrHandler
    StatusRoute --> ReqLog
    StatusRoute --> Registry
```

### Project Structure

```
packages/
  api-server/              Express 5 + TypeScript
    gateway/
      config.ts              Constants (meta-models, priorities, limits)
      router.ts              Failover loop with round-robin/random
      registry.ts            Provider lifecycle management
      circuit-breaker.ts     Three-state health tracking
      rate-limiter.ts        Sliding-window + cooldown
      schemas.ts             Zod validation schemas
      providers/             One adapter per provider
    middleware/
      auth.ts                API key auth (timing-safe)
      admin-auth.ts          Admin-only route protection
      rate-limit.ts          Per-client IP rate limiting
      error-handler.ts       Centralized error formatting
      validate.ts            Zod validation middleware
    routes/v1/               OpenAI-compatible HTTP handlers

  dashboard/               React 18 + Vite + Tailwind
    components/              Focused, single-responsibility UI
    pages/                   Dashboard, Models, Quickstart

lib/
  api-spec/                OpenAPI 3.1 spec (source of truth)
  api-client-react/        Auto-generated React Query hooks
```

## Tech Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix_UI-161618?style=for-the-badge&logo=radixui&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![React Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge&logo=reactquery&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)
![OpenAPI](https://img.shields.io/badge/OpenAPI-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)
![Pino](https://img.shields.io/badge/Pino-687634?style=for-the-badge&logoColor=white)

## Contributing

```bash
git checkout -b feat/your-feature
# make changes
git commit -m "feat: describe what you built"
git push origin feat/your-feature
# open a PR
```

## License

[MIT](LICENSE)
