# FreeLLM Architecture Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the FreeLLM codebase from a messy Replit-generated layout into a clean, testable, maintainable monorepo following senior-dev conventions.

**Architecture:** Rename `artifacts/` → `packages/`, add root workspace config, extract shared constants/types, add missing foundational files (logger, health route, gitignore, tsconfigs), centralize error handling and validation, simplify the redundant provider model-map pattern, and break monolithic dashboard pages into focused components.

**Tech Stack:** pnpm workspaces, TypeScript 5.9, Express 5, React 18, Vite, Zod, Tailwind CSS

---

## Target File Structure

```
freellm/
├── package.json                          # Root workspace config
├── pnpm-workspace.yaml                   # Workspace definition
├── tsconfig.base.json                    # Shared TS config
├── .gitignore                            # Root gitignore
├── packages/
│   ├── api-server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app.ts                    # Express app setup
│   │       ├── server.ts                 # Entry point (listen)
│   │       ├── lib/
│   │       │   └── logger.ts             # Pino logger singleton
│   │       ├── middleware/
│   │       │   ├── error-handler.ts      # Centralized error → JSON
│   │       │   └── validate.ts           # Zod validation middleware
│   │       ├── routes/
│   │       │   ├── index.ts              # Mount all routers
│   │       │   ├── health.ts             # GET /healthz
│   │       │   └── v1/
│   │       │       ├── index.ts
│   │       │       ├── chat.ts
│   │       │       ├── models.ts
│   │       │       └── status.ts
│   │       └── gateway/
│   │           ├── index.ts              # Public exports only
│   │           ├── config.ts             # Meta-models, provider priorities, defaults
│   │           ├── router.ts             # GatewayRouter (routing + failover)
│   │           ├── registry.ts           # ProviderRegistry
│   │           ├── request-log.ts        # RequestLog
│   │           ├── circuit-breaker.ts    # CircuitBreaker
│   │           ├── rate-limiter.ts       # RateLimiter
│   │           ├── types.ts              # Gateway-specific types
│   │           └── providers/
│   │               ├── types.ts          # ProviderAdapter interface
│   │               ├── base.ts           # BaseProvider (auto model-map)
│   │               ├── groq.ts
│   │               ├── gemini.ts
│   │               ├── mistral.ts
│   │               ├── cerebras.ts
│   │               └── ollama.ts
│   └── dashboard/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── index.css
│           ├── lib/
│           │   └── utils.ts              # cn() helper
│           ├── components/
│           │   ├── layout.tsx            # Shell (sidebar, mobile nav)
│           │   ├── logo.tsx              # FreeLLMLogo SVG extracted
│           │   ├── provider-card.tsx     # Single provider health card
│           │   ├── metrics-row.tsx       # Total/Success/Failed cards
│           │   ├── request-table.tsx     # Recent requests table
│           │   ├── routing-toggle.tsx    # Routing strategy switch
│           │   └── ui/                   # shadcn primitives (card, badge, etc.)
│           │       ├── card.tsx
│           │       ├── badge.tsx
│           │       ├── button.tsx
│           │       ├── switch.tsx
│           │       └── table.tsx
│           └── pages/
│               ├── dashboard.tsx         # Composes extracted components
│               ├── models.tsx
│               ├── quickstart.tsx
│               └── not-found.tsx
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml
│   └── api-client-react/
│       └── src/generated/api.ts
└── docs/
```

---

### Task 1: Root Workspace Config & Gitignore

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "freellm",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "typecheck": "pnpm -r run typecheck"
  },
  "engines": {
    "node": ">=24"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "lib/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.env
*.tsbuildinfo
.turbo/
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: add root workspace config, tsconfig, and gitignore"
```

---

### Task 2: Rename `artifacts/` → `packages/`

**Files:**
- Rename: `artifacts/` → `packages/`
- Modify: `pnpm-workspace.yaml` (already points to `packages/*`)
- Modify: any import paths referencing `artifacts/` (none — workspace aliases handle this)

- [ ] **Step 1: Move the directory**

```bash
git mv artifacts packages
```

- [ ] **Step 2: Verify nothing references `artifacts/` literally**

```bash
grep -r "artifacts" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yaml" .
```

Expected: No hits (all cross-package refs use `@workspace/*` aliases).

- [ ] **Step 3: Update `replit.md` if it references `artifacts/`**

Read `replit.md` and replace any `artifacts/` paths with `packages/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: rename artifacts/ to packages/ for standard monorepo layout"
```

---

### Task 3: Create Missing Foundational Files (Logger, Health Route, Utils)

**Files:**
- Create: `packages/api-server/src/lib/logger.ts`
- Create: `packages/api-server/src/routes/health.ts`
- Create: `packages/dashboard/src/lib/utils.ts`

- [ ] **Step 1: Create logger**

The app imports `./lib/logger` in `app.ts` and `chat.ts`. Create the file:

```typescript
// packages/api-server/src/lib/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport:
    process.env["NODE_ENV"] === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
```

- [ ] **Step 2: Create health route**

`routes/index.ts` imports `./health.js` but the file doesn't exist. Create it:

```typescript
// packages/api-server/src/routes/health.ts
import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default healthRouter;
```

- [ ] **Step 3: Create dashboard utils**

The dashboard imports `@/lib/utils` for the `cn()` helper. Create it:

```typescript
// packages/dashboard/src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/api-server/src/lib/logger.ts packages/api-server/src/routes/health.ts packages/dashboard/src/lib/utils.ts
git commit -m "fix: create missing logger, health route, and cn() utility"
```

---

### Task 4: Extract Gateway Config Constants

**Problem:** Meta-model sets, provider priority lists, and default model mappings are duplicated across `router.ts`, `registry.ts`, and `models.ts`.

**Files:**
- Create: `packages/api-server/src/gateway/config.ts`
- Modify: `packages/api-server/src/gateway/router.ts`
- Modify: `packages/api-server/src/gateway/registry.ts`
- Modify: `packages/api-server/src/routes/v1/models.ts`

- [ ] **Step 1: Create `gateway/config.ts`**

```typescript
// packages/api-server/src/gateway/config.ts

/** Provider IDs ordered by speed (lowest latency first). */
export const FAST_PRIORITY = ["groq", "cerebras", "gemini", "mistral", "ollama"] as const;

/** Provider IDs ordered by intelligence (most capable first). */
export const SMART_PRIORITY = ["gemini", "groq", "mistral", "cerebras", "ollama"] as const;

/** The set of meta-model names that trigger multi-provider routing. */
export const META_MODELS = new Set(["free", "free-fast", "free-smart"]);

/** Default concrete model to use per provider when a meta-model is requested. */
export const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  mistral: "mistral-small-latest",
  cerebras: "llama3.3-70b",
  ollama: "llama3",
};

/** 4xx codes that should NOT trigger failover (client/config errors). */
export const NON_RETRIABLE_STATUSES = new Set([400, 401, 403, 404]);

/** Meta-model entries returned by GET /v1/models. */
export const META_MODEL_ENTRIES = [
  { id: "free",      object: "model" as const, created: 1700000000, owned_by: "freellm", provider: "freellm" },
  { id: "free-fast",  object: "model" as const, created: 1700000000, owned_by: "freellm", provider: "freellm" },
  { id: "free-smart", object: "model" as const, created: 1700000000, owned_by: "freellm", provider: "freellm" },
];
```

- [ ] **Step 2: Update `router.ts` — replace inline constants with imports**

In `packages/api-server/src/gateway/router.ts`, remove:
```typescript
const META_MODELS = new Set(["free", "free-fast", "free-smart"]);

const DEFAULT_MODELS: Record<string, string> = {
  "groq": "llama-3.3-70b-versatile",
  "gemini": "gemini-2.0-flash",
  "mistral": "mistral-small-latest",
  "cerebras": "llama3.3-70b",
  "ollama": "llama3",
};

const NON_RETRIABLE_STATUSES = new Set([400, 401, 403, 404]);
```

Replace with:
```typescript
import { META_MODELS, DEFAULT_MODELS, NON_RETRIABLE_STATUSES } from "./config.js";
```

- [ ] **Step 3: Update `registry.ts` — replace inline priority arrays with imports**

In `packages/api-server/src/gateway/registry.ts`, add import:
```typescript
import { FAST_PRIORITY, SMART_PRIORITY } from "./config.js";
```

Replace the hardcoded arrays inside `resolveMetaModel()` and `getProviderForMetaModel()`:
- `["groq", "cerebras", "gemini", "mistral", "ollama"]` → `[...FAST_PRIORITY]`
- `["gemini", "groq", "mistral", "cerebras", "ollama"]` → `[...SMART_PRIORITY]`

- [ ] **Step 4: Update `models.ts` — replace inline META_MODELS array with import**

In `packages/api-server/src/routes/v1/models.ts`, remove the inline `META_MODELS` array and replace:

```typescript
import { META_MODEL_ENTRIES } from "../../gateway/config.js";
```

Then in the handler:
```typescript
const all = [...META_MODEL_ENTRIES, ...providerModels];
```

- [ ] **Step 5: Run typecheck to verify**

```bash
cd packages/api-server && pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/api-server/src/gateway/config.ts packages/api-server/src/gateway/router.ts packages/api-server/src/gateway/registry.ts packages/api-server/src/routes/v1/models.ts
git commit -m "refactor: extract gateway constants to single config.ts source of truth"
```

---

### Task 5: Simplify Provider Model Maps

**Problem:** Every provider manually writes a `getModelMap()` that just strips the `provider/` prefix. E.g. Groq maps `"groq/llama-3.3-70b-versatile"` → `"llama-3.3-70b-versatile"`. This is boilerplate — the prefix is always `{provider.id}/`.

**Files:**
- Modify: `packages/api-server/src/gateway/providers/base.ts`
- Modify: `packages/api-server/src/gateway/providers/groq.ts`
- Modify: `packages/api-server/src/gateway/providers/gemini.ts`
- Modify: `packages/api-server/src/gateway/providers/mistral.ts`
- Modify: `packages/api-server/src/gateway/providers/cerebras.ts`
- Modify: `packages/api-server/src/gateway/providers/ollama.ts`

- [ ] **Step 1: Update `base.ts` — auto-strip prefix in `mapRequest`**

In `packages/api-server/src/gateway/providers/base.ts`, replace the `mapRequest` method:

```typescript
protected mapRequest(request: ChatCompletionRequest): ChatCompletionRequest {
  const mapped = { ...request };
  const prefix = `${this.id}/`;
  if (mapped.model.startsWith(prefix)) {
    mapped.model = mapped.model.slice(prefix.length);
  }
  return mapped;
}
```

Remove the `getModelMap()` method entirely from `BaseProvider`:
```typescript
// DELETE these lines:
protected getModelMap(): Record<string, string> {
  return {};
}
```

- [ ] **Step 2: Remove `getModelMap()` from all 5 providers**

In each provider file (`groq.ts`, `gemini.ts`, `mistral.ts`, `cerebras.ts`, `ollama.ts`), delete the entire `getModelMap()` override. For example, in `groq.ts` remove:

```typescript
// DELETE:
protected getModelMap(): Record<string, string> {
  return {
    "groq/llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
    "groq/llama-3.1-8b-instant": "llama-3.1-8b-instant",
    "groq/gemma2-9b-it": "gemma2-9b-it",
    "groq/mixtral-8x7b-32768": "mixtral-8x7b-32768",
    "groq/llama3-8b-8192": "llama3-8b-8192",
    "groq/llama3-70b-8192": "llama3-70b-8192",
  };
}
```

Do the same for all other providers.

- [ ] **Step 3: Run typecheck**

```bash
cd packages/api-server && pnpm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/api-server/src/gateway/providers/
git commit -m "refactor: auto-strip provider prefix instead of manual model maps"
```

---

### Task 6: Centralized Error Handling Middleware

**Problem:** `chat.ts` has ~100 lines of duplicated try/catch/format-error logic. `status.ts` and `models.ts` would need the same pattern for consistency. Express 5 supports async error propagation natively.

**Files:**
- Create: `packages/api-server/src/middleware/error-handler.ts`
- Modify: `packages/api-server/src/app.ts`
- Modify: `packages/api-server/src/routes/v1/chat.ts`

- [ ] **Step 1: Create error handler middleware**

```typescript
// packages/api-server/src/middleware/error-handler.ts
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

// Import these from gateway — they already exist
import { AllProvidersExhaustedError, ProviderClientError } from "../gateway/index.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ProviderClientError) {
    // Non-retriable upstream error — proxy the status code
    err.upstreamResponse
      .json()
      .then((body) => res.status(err.statusCode).json(body))
      .catch(() =>
        res.status(err.statusCode).json({
          error: { message: err.message, type: "provider_error" },
        }),
      );
    return;
  }

  if (err instanceof AllProvidersExhaustedError) {
    res.status(429).json({
      error: {
        message: err.message,
        type: "rate_limit_error",
        code: "all_providers_exhausted",
      },
    });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: { message: "Internal server error", type: "internal_error" },
  });
}
```

- [ ] **Step 2: Mount error handler in `app.ts`**

In `packages/api-server/src/app.ts`, add after the router mounts:

```typescript
import { errorHandler } from "./middleware/error-handler.js";

// ... existing router mounts ...

app.use(errorHandler);
```

- [ ] **Step 3: Simplify `chat.ts` non-streaming handler**

Replace `handleNonStreamingRequest` in `packages/api-server/src/routes/v1/chat.ts`:

```typescript
async function handleNonStreamingRequest(
  res: Response,
  next: NextFunction,
  body: ChatCompletionRequest,
) {
  try {
    const data = await gatewayRouter.complete(body);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
```

Update the route handler signature to pass `next`:

```typescript
chatRouter.post("/completions", async (req: Request, res: Response, next: NextFunction) => {
  // ... validation ...

  if (body.stream) {
    await handleStreamingRequest(req, res, body);
  } else {
    await handleNonStreamingRequest(res, next, body);
  }
});
```

Note: The streaming handler keeps its own error logic because it must handle the case where headers are already sent (SSE mid-stream). Only the non-streaming path and the pre-header streaming errors benefit from the middleware.

- [ ] **Step 4: Run typecheck**

```bash
cd packages/api-server && pnpm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/api-server/src/middleware/error-handler.ts packages/api-server/src/app.ts packages/api-server/src/routes/v1/chat.ts
git commit -m "refactor: centralize error handling in Express middleware"
```

---

### Task 7: Add Zod Request Validation Middleware

**Problem:** `chat.ts` does `req.body as ChatCompletionRequest` with a manual `if (!body.model || !body.messages)` check. The `@workspace/api-zod` package already exists as a dependency but isn't used. The `status.ts` route also casts `req.body` without validation.

**Files:**
- Create: `packages/api-server/src/middleware/validate.ts`
- Modify: `packages/api-server/src/routes/v1/chat.ts`
- Modify: `packages/api-server/src/routes/v1/status.ts`

- [ ] **Step 1: Create validation middleware**

```typescript
// packages/api-server/src/middleware/validate.ts
import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

export function validate<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          message: result.error.issues.map((i) => i.message).join("; "),
          type: "invalid_request_error",
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 2: Create Zod schemas for gateway requests**

If `@workspace/api-zod` already provides these schemas, import from there. If not, add them inline in a new file:

```typescript
// packages/api-server/src/gateway/schemas.ts
import { z } from "zod";

export const chatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.string().nullable(),
      name: z.string().nullable().optional(),
    }),
  ).min(1),
  stream: z.boolean().nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  max_tokens: z.number().int().min(1).nullable().optional(),
  top_p: z.number().nullable().optional(),
  stop: z.union([z.string(), z.array(z.string())]).nullable().optional(),
});

export const updateRoutingSchema = z.object({
  strategy: z.enum(["round_robin", "random"]),
});
```

- [ ] **Step 3: Wire validation into `chat.ts`**

```typescript
import { validate } from "../../middleware/validate.js";
import { chatCompletionRequestSchema } from "../../gateway/schemas.js";

chatRouter.post(
  "/completions",
  validate(chatCompletionRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const body = req.body; // already validated and typed
    if (body.stream) {
      await handleStreamingRequest(req, res, body);
    } else {
      await handleNonStreamingRequest(res, next, body);
    }
  },
);
```

Remove the manual validation block:
```typescript
// DELETE:
if (!body.model || !body.messages || !Array.isArray(body.messages)) {
  res.status(400).json({ ... });
  return;
}
```

- [ ] **Step 4: Wire validation into `status.ts`**

```typescript
import { validate } from "../../middleware/validate.js";
import { updateRoutingSchema } from "../../gateway/schemas.js";

statusRouter.patch("/routing", validate(updateRoutingSchema), (req, res) => {
  const { strategy } = req.body;
  // ... rest unchanged, remove the manual strategy check ...
});
```

Remove the manual validation block:
```typescript
// DELETE:
if (strategy !== "round_robin" && strategy !== "random") {
  res.status(400).json({ ... });
  return;
}
```

- [ ] **Step 5: Run typecheck**

```bash
cd packages/api-server && pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/api-server/src/middleware/validate.ts packages/api-server/src/gateway/schemas.ts packages/api-server/src/routes/v1/chat.ts packages/api-server/src/routes/v1/status.ts
git commit -m "refactor: add Zod validation middleware, remove manual request checks"
```

---

### Task 8: Clean Up Gateway Index Exports

**Problem:** `gateway/index.ts` creates singleton instances at module level (`export const registry = new ProviderRegistry()`) making it impossible to test with fresh instances. It also re-exports internal classes that should stay private.

**Files:**
- Modify: `packages/api-server/src/gateway/index.ts`
- Create: `packages/api-server/src/gateway/create.ts`
- Modify: `packages/api-server/src/routes/v1/chat.ts`
- Modify: `packages/api-server/src/routes/v1/status.ts`
- Modify: `packages/api-server/src/routes/v1/models.ts`

- [ ] **Step 1: Create a factory function**

```typescript
// packages/api-server/src/gateway/create.ts
import { ProviderRegistry } from "./registry.js";
import { GatewayRouter } from "./router.js";

export interface Gateway {
  registry: ProviderRegistry;
  router: GatewayRouter;
}

export function createGateway(): Gateway {
  const registry = new ProviderRegistry();
  const router = new GatewayRouter(registry);
  return { registry, router };
}
```

- [ ] **Step 2: Update `gateway/index.ts` to use the factory**

```typescript
// packages/api-server/src/gateway/index.ts
export { createGateway, type Gateway } from "./create.js";
export { AllProvidersExhaustedError, ProviderClientError } from "./router.js";
export type * from "./types.js";

// App-level singleton — created once, imported by routes
import { createGateway } from "./create.js";
const { registry, router } = createGateway();
export { registry, router };
```

This keeps backward compatibility (routes still import `registry` and `router`) while making the factory available for tests.

- [ ] **Step 3: Commit**

```bash
git add packages/api-server/src/gateway/create.ts packages/api-server/src/gateway/index.ts
git commit -m "refactor: add gateway factory for testability, keep singleton for app"
```

---

### Task 9: Extract Dashboard Components from Monolithic Pages

**Problem:** `dashboard.tsx` is 263 lines — provider cards, metrics row, request table, routing toggle, and status helpers all inline. This makes it hard to modify or reuse any piece.

**Files:**
- Create: `packages/dashboard/src/components/logo.tsx`
- Create: `packages/dashboard/src/components/provider-card.tsx`
- Create: `packages/dashboard/src/components/metrics-row.tsx`
- Create: `packages/dashboard/src/components/request-table.tsx`
- Create: `packages/dashboard/src/components/routing-toggle.tsx`
- Modify: `packages/dashboard/src/components/layout.tsx`
- Modify: `packages/dashboard/src/pages/dashboard.tsx`

- [ ] **Step 1: Extract `logo.tsx` from `layout.tsx`**

Move the `FreeLLMLogo` component (lines 7-26 of `layout.tsx`) into its own file:

```tsx
// packages/dashboard/src/components/logo.tsx
export function FreeLLMLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="hsl(150 100% 40% / 0.15)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="hsl(150 100% 40% / 0.4)" />
      <circle cx="7" cy="16" r="2" fill="hsl(150 100% 40%)" />
      <circle cx="25" cy="10" r="2" fill="hsl(150 100% 40%)" />
      <circle cx="25" cy="22" r="2" fill="hsl(150 100% 40%)" />
      <circle cx="16" cy="16" r="1.5" fill="hsl(150 100% 40% / 0.6)" />
      <line x1="9" y1="15.5" x2="14.5" y2="15" stroke="hsl(150 100% 40%)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="17.5" y1="15" x2="23" y2="10.5" stroke="hsl(150 100% 40%)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="17.5" y1="17" x2="23" y2="21.5" stroke="hsl(150 100% 40%)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="23" y1="8" x2="27" y2="10" stroke="hsl(150 100% 40% / 0.4)" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="23" y1="20" x2="27" y2="22" stroke="hsl(150 100% 40% / 0.4)" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
```

Update `layout.tsx` to import it:
```tsx
import { FreeLLMLogo } from "./logo";
```

Delete the inline `FreeLLMLogo` function from `layout.tsx`.

- [ ] **Step 2: Extract `routing-toggle.tsx`**

```tsx
// packages/dashboard/src/components/routing-toggle.tsx
import { ArrowRightLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface RoutingToggleProps {
  strategy: string | undefined;
  onToggle: (checked: boolean) => void;
  disabled: boolean;
}

export function RoutingToggle({ strategy, onToggle, disabled }: RoutingToggleProps) {
  return (
    <div className="flex items-center gap-3 bg-card border border-border px-3 py-2 rounded-md shadow-sm self-start sm:self-auto">
      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Routing:</span>
        <span className="text-foreground uppercase tracking-widest text-xs font-mono">
          {strategy?.replace("_", " ")}
        </span>
      </span>
      <Switch
        checked={strategy === "round_robin"}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}
```

- [ ] **Step 3: Extract `metrics-row.tsx`**

```tsx
// packages/dashboard/src/components/metrics-row.tsx
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricsRowProps {
  total: number;
  success: number;
  failed: number;
}

export function MetricsRow({ total, success, failed }: MetricsRowProps) {
  const items = [
    { label: "Total", value: total, icon: Activity, iconClass: "text-muted-foreground", bgClass: "bg-secondary/50", valueClass: "" },
    { label: "Success", value: success, icon: CheckCircle2, iconClass: "text-primary", bgClass: "bg-primary/10", valueClass: "text-primary" },
    { label: "Failed", value: failed, icon: XCircle, iconClass: "text-destructive", bgClass: "bg-destructive/10", valueClass: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4">
      {items.map((item) => (
        <Card key={item.label} className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <div className={`hidden md:flex p-3 ${item.bgClass} rounded-md w-fit`}>
                <item.icon className={`w-5 h-5 ${item.iconClass}`} />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className={`text-2xl md:text-3xl font-mono font-bold ${item.valueClass}`}>
                  {item.value.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Extract `provider-card.tsx`**

```tsx
// packages/dashboard/src/components/provider-card.tsx
import { AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProviderCardProps {
  provider: {
    id: string;
    name: string;
    enabled: boolean;
    circuitBreakerState: string;
    successRequests: number;
    failedRequests: number;
    lastError?: string | null;
    lastUsedAt?: string | null;
  };
  onReset: (providerId: string) => void;
  resetPending: boolean;
}

function getStatusColor(state: string, enabled: boolean) {
  if (!enabled) return "bg-muted text-muted-foreground border-muted";
  switch (state) {
    case "closed": return "bg-primary/10 text-primary border-primary/20";
    case "open": return "bg-destructive/10 text-destructive border-destructive/20";
    case "half_open": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    default: return "bg-muted text-muted-foreground border-muted";
  }
}

function getStatusText(state: string, enabled: boolean) {
  if (!enabled) return "Disabled";
  switch (state) {
    case "closed": return "Healthy";
    case "open": return "Failing";
    case "half_open": return "Testing";
    default: return "Unknown";
  }
}

export function ProviderCard({ provider, onReset, resetPending }: ProviderCardProps) {
  const showReset = provider.circuitBreakerState === "open" || provider.circuitBreakerState === "half_open";

  return (
    <Card className={cn("overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all", !provider.enabled && "opacity-60")}>
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-mono text-lg">{provider.name}</CardTitle>
            <CardDescription className="text-xs font-mono mt-1">{provider.id}</CardDescription>
          </div>
          <Badge variant="outline" className={cn("uppercase text-[10px] tracking-wider", getStatusColor(provider.circuitBreakerState, provider.enabled))}>
            {getStatusText(provider.circuitBreakerState, provider.enabled)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm font-mono">
          <div className="flex flex-col p-2 bg-secondary/30 rounded-md border border-border/20">
            <span className="text-muted-foreground text-xs uppercase">Success</span>
            <span className="text-foreground">{provider.successRequests}</span>
          </div>
          <div className="flex flex-col p-2 bg-secondary/30 rounded-md border border-border/20">
            <span className="text-muted-foreground text-xs uppercase">Failed</span>
            <span className={cn("text-foreground", provider.failedRequests > 0 && "text-destructive")}>{provider.failedRequests}</span>
          </div>
        </div>

        {provider.lastError && (
          <div className="p-2 rounded border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-start gap-2 overflow-hidden">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="truncate" title={provider.lastError}>{provider.lastError}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {provider.lastUsedAt ? new Date(provider.lastUsedAt).toLocaleTimeString() : "Never"}
          </div>
          {showReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReset(provider.id)}
              disabled={resetPending}
              className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", resetPending && "animate-spin")} /> Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Extract `request-table.tsx`**

```tsx
// packages/dashboard/src/components/request-table.tsx
import { ArrowDownUp, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface RequestEntry {
  id: string;
  timestamp: string;
  status: string;
  requestedModel: string;
  provider?: string | null;
  latencyMs: number;
}

interface RequestTableProps {
  requests: RequestEntry[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase rounded-sm font-normal py-0">OK</Badge>;
  }
  if (status === "rate_limited") {
    return <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 text-[10px] uppercase rounded-sm font-normal py-0">429</Badge>;
  }
  return <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-[10px] uppercase rounded-sm font-normal py-0">ERR</Badge>;
}

export function RequestTable({ requests }: RequestTableProps) {
  return (
    <div>
      <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
        <ArrowDownUp className="w-5 h-5 text-muted-foreground" /> Recent Requests
      </h2>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Time</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Model</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Provider</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!requests.length ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground font-mono text-sm">
                    No requests yet. Waiting for traffic...
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id} className="border-border/10 border-b hover:bg-secondary/30 transition-colors font-mono text-sm">
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(req.timestamp).toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 2 })}
                    </TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="max-w-[150px] truncate" title={req.requestedModel}>{req.requestedModel}</TableCell>
                    <TableCell className="text-muted-foreground">{req.provider || "-"}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn("inline-flex items-center gap-1", req.latencyMs > 2000 ? "text-amber-500" : "text-muted-foreground")}>
                        {req.latencyMs > 2000 && <Zap className="w-3 h-3" />}
                        {req.latencyMs}ms
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `dashboard.tsx` as a composition of extracted components**

```tsx
// packages/dashboard/src/pages/dashboard.tsx
import { useGetGatewayStatus, useResetProviderCircuitBreaker, useUpdateRoutingStrategy, getGetGatewayStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Server } from "lucide-react";
import { toast } from "sonner";
import { RoutingToggle } from "@/components/routing-toggle";
import { MetricsRow } from "@/components/metrics-row";
import { ProviderCard } from "@/components/provider-card";
import { RequestTable } from "@/components/request-table";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetGatewayStatus({
    query: { refetchInterval: 3000, queryKey: getGetGatewayStatusQueryKey() },
  });

  const resetCircuitBreaker = useResetProviderCircuitBreaker({
    mutation: {
      onSuccess: () => {
        toast.success("Circuit breaker reset");
        queryClient.invalidateQueries({ queryKey: getGetGatewayStatusQueryKey() });
      },
      onError: () => toast.error("Failed to reset circuit breaker"),
    },
  });

  const updateRouting = useUpdateRoutingStrategy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetGatewayStatusQueryKey() });
      },
    },
  });

  if (isLoading && !status) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-card rounded-lg" />
          <div className="h-32 bg-card rounded-lg" />
          <div className="h-32 bg-card rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-mono font-bold tracking-tight">Gateway Status</h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time metrics and routing control.</p>
        </div>
        <RoutingToggle
          strategy={status?.routingStrategy}
          onToggle={(checked) => updateRouting.mutate({ data: { strategy: checked ? "round_robin" : "random" } })}
          disabled={updateRouting.isPending}
        />
      </div>

      <MetricsRow
        total={status?.totalRequests ?? 0}
        success={status?.successRequests ?? 0}
        failed={status?.failedRequests ?? 0}
      />

      <div>
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-muted-foreground" /> Providers
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {status?.providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onReset={(id) => resetCircuitBreaker.mutate({ providerId: id })}
              resetPending={resetCircuitBreaker.isPending}
            />
          ))}
        </div>
      </div>

      <RequestTable requests={status?.recentRequests ?? []} />
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/components/ packages/dashboard/src/pages/dashboard.tsx
git commit -m "refactor: extract dashboard into focused components"
```

---

### Task 10: Create shadcn UI Component Stubs

**Problem:** The dashboard imports from `@/components/ui/card`, `@/components/ui/badge`, etc. but these files don't exist in the repo. They were likely generated on Replit but never committed.

**Files:**
- Create: `packages/dashboard/src/components/ui/card.tsx`
- Create: `packages/dashboard/src/components/ui/badge.tsx`
- Create: `packages/dashboard/src/components/ui/button.tsx`
- Create: `packages/dashboard/src/components/ui/switch.tsx`
- Create: `packages/dashboard/src/components/ui/table.tsx`

- [ ] **Step 1: Generate shadcn components**

The cleanest approach is to use the shadcn CLI from the dashboard package directory:

```bash
cd packages/dashboard
npx shadcn@latest init --defaults
npx shadcn@latest add card badge button switch table
```

If the CLI isn't available or fails, manually create the files using the standard shadcn source. Each file follows the same pattern — a thin wrapper around Radix primitives + Tailwind classes.

- [ ] **Step 2: Verify all dashboard imports resolve**

```bash
cd packages/dashboard && pnpm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/components/ui/
git commit -m "chore: commit shadcn UI primitives that were missing from repo"
```

---

### Task 11: Remove Dead `resolveMetaModel` from Registry

**Problem:** `registry.ts` has two methods for meta-model resolution: `resolveMetaModel()` (private, used by `resolveProvider()`) and `getProviderForMetaModel()` (public, used by `router.ts`). The `resolveProvider()` method that calls `resolveMetaModel()` is never called anywhere — `router.ts` uses `getProviderForMetaModel()` directly.

**Files:**
- Modify: `packages/api-server/src/gateway/registry.ts`

- [ ] **Step 1: Verify `resolveProvider` is unused**

```bash
grep -r "resolveProvider" packages/api-server/src/ --include="*.ts"
```

Expected: Only the definition in `registry.ts`, no callers.

- [ ] **Step 2: Remove dead code**

Delete `resolveProvider()` and `resolveMetaModel()` from `registry.ts` (lines 44-76 of the current file).

- [ ] **Step 3: Run typecheck**

```bash
cd packages/api-server && pnpm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/api-server/src/gateway/registry.ts
git commit -m "refactor: remove unused resolveProvider/resolveMetaModel dead code"
```

---

## Summary

| Task | What it does | Risk |
|------|-------------|------|
| 1 | Root workspace config | Low — additive |
| 2 | Rename artifacts/ → packages/ | Medium — touches all paths |
| 3 | Create missing files (logger, health, utils) | Low — fixes broken imports |
| 4 | Extract gateway config constants | Low — move + import |
| 5 | Simplify provider model maps | Low — mechanical replacement |
| 6 | Centralized error middleware | Medium — changes error flow |
| 7 | Zod validation middleware | Medium — changes validation flow |
| 8 | Gateway factory for testability | Low — additive |
| 9 | Extract dashboard components | Low — pure refactor |
| 10 | Commit missing shadcn UI files | Low — additive |
| 11 | Remove dead code | Low — deletion of unused methods |

**Execution order matters:** Tasks 1-2 must go first (directory rename). Task 3 should follow (fix broken imports). Tasks 4-11 are independent and can be parallelized.
