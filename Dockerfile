FROM node:24-slim AS base

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps

COPY package.json pnpm-workspace.yaml ./
COPY packages/api-server/package.json packages/api-server/
COPY lib/api-client-react/package.json lib/api-client-react/ 2>/dev/null || true
COPY lib/api-spec/package.json lib/api-spec/ 2>/dev/null || true

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install --no-frozen-lockfile

# ── Build ──
FROM deps AS build

COPY packages/api-server/ packages/api-server/
COPY lib/ lib/

RUN cd packages/api-server && pnpm run build

# ── Production ──
FROM base AS production

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api-server/node_modules ./packages/api-server/node_modules
COPY --from=build /app/packages/api-server/dist ./packages/api-server/dist
COPY --from=build /app/packages/api-server/package.json ./packages/api-server/

WORKDIR /app/packages/api-server

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
