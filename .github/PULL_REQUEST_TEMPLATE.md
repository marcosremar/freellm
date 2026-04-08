## What does this PR do?

<!-- One or two sentences. Focus on *why*, not just *what*. -->

Closes #<!-- issue number -->

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] New provider adapter
- [ ] Dashboard / UI improvement
- [ ] Website / docs update
- [ ] Refactor
- [ ] Security fix
- [ ] Documentation only

## Changes

<!-- Bullet list of the key changes. Keep it concise. -->

-

## Screenshots / Video

<!-- Required for any UI change (dashboard or website). Delete this section if not applicable. -->

## How was this tested?

<!-- Describe what you did to verify. Which providers, which env vars, which edge cases. -->

- [ ] `pnpm typecheck` passes in every package
- [ ] `./scripts/test-gateway.sh` runs cleanly (all 18 tests pass)
- [ ] Manually verified the change end-to-end against a running gateway
- [ ] Tested with at least two providers configured (multi-provider failover paths)

## New Provider Checklist

<!-- Only for new provider adapter PRs. Delete this section otherwise. -->

- [ ] Created `packages/api-server/src/gateway/providers/<name>.ts` extending `BaseProvider`
- [ ] Set `id`, `name`, `baseUrl`, and a `models` array with the `<name>/` prefix
- [ ] Implemented `getApiKeys()` reading the env var via `parseApiKeys()`
- [ ] Registered the provider in `gateway/registry.ts`
- [ ] Added the provider to `FAST_PRIORITY` and `SMART_PRIORITY` in `gateway/config.ts`
- [ ] Added a default model in `DEFAULT_MODELS` in `gateway/config.ts`
- [ ] Added a per-key rate-limit config in `gateway/rate-limiter.ts`
- [ ] Updated `.env.example` with the new env var
- [ ] Updated the README Providers table
- [ ] Updated the website provider showcase and docs
- [ ] Verified the new provider works end-to-end with a real API key

## Checklist

- [ ] Self-reviewed my own code
- [ ] No `console.log` statements left in committed code (use the `pino` logger)
- [ ] No commented-out code blocks
- [ ] No `any` types added (or commented why if unavoidable)
- [ ] No new native dependencies (anything needing `node-gyp` is rejected)
- [ ] Commits follow conventional format (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `security:`)
- [ ] No co-author lines in commit messages
