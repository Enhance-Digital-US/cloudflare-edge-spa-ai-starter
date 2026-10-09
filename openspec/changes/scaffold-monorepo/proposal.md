# Proposal

## Why

There is no opinionated, batteries-included starter template for building AI-powered SPAs on Cloudflare's platform. Developers starting a new AI app must manually wire together React, a Workers backend, AI bindings, dev tooling, and deployment — making dozens of compatibility decisions along the way. This template eliminates that friction by providing a production-ready monorepo scaffold with every layer pre-integrated and tested against the Workers runtime.

## What Changes

- Scaffold a pnpm monorepo with five packages: `apps/web` (React SPA), `apps/api` (Hono Worker), `packages/ui` (shadcn components), `packages/shared` (cross-runtime types/schemas), `packages/tsconfig` (shared TypeScript configs)
- Configure a unified Worker deployment model: Hono serves API routes and the built SPA via Cloudflare's `assets` binding from a root `wrangler.jsonc`
- Integrate TanStack AI with the `@cloudflare/tanstack-ai` adapter for Workers AI and AI Gateway access (streaming chat, tool calling, structured output)
- Wire TanStack Router (file-based) for client-side routing with type-safe route definitions
- Set up shadcn/ui in `packages/ui` with Tailwind CSS v4, shared across the SPA
- Implement Cloudflare Access authentication middleware in Hono, designed for easy swap to better-auth or other providers
- Configure Biome (lint + format), Vitest with `@cloudflare/vitest-pool-workers`, lefthook (git hooks), and per-runtime TypeScript configs (web/worker/shared)
- Add GitHub Actions CI/CD: PR checks (lint, typecheck, test) and deploy-on-push-to-main via `wrangler deploy`

## Capabilities

### New Capabilities

- `monorepo-workspace`: pnpm workspace layout with five packages, package boundaries enforced by per-runtime TypeScript configs, root-level scripts for dev/build/deploy
- `spa-frontend`: React SPA with TanStack Router file-based routing, shadcn/ui design system, Tailwind CSS v4, Vite build, proxy-based dev server
- `api-worker`: Hono backend on Cloudflare Workers serving API routes and SPA static assets via the `assets` binding, typed environment bindings for all Cloudflare services
- `ai-integration`: TanStack AI with `@cloudflare/tanstack-ai` adapter, AI Gateway configuration, streaming chat endpoint, React hooks via `@tanstack/ai-react`
- `auth-middleware`: Cloudflare Access JWT validation as default auth, extensible middleware pattern for swapping to better-auth or other providers
- `dev-tooling`: Biome for lint/format, Vitest with `@cloudflare/vitest-pool-workers` for Worker-native tests, shared tsconfig package with web/worker/shared presets, lefthook for pre-commit hooks
- `ci-cd-pipeline`: GitHub Actions workflows for PR checks (lint, typecheck, test) and automated deployment to Cloudflare via `wrangler deploy` on push to main

### Modified Capabilities

_None — greenfield project with no existing capabilities._

## Impact

- **New files**: ~40-50 files across the monorepo scaffold (configs, source files, CI workflows)
- **Dependencies**: React 19, Hono, TanStack Router, TanStack AI, shadcn/ui + Radix UI, Tailwind CSS v4, Zod, Biome, Vitest, Wrangler, lefthook
- **Cloudflare services**: Workers, Workers AI, AI Gateway, D1, KV, R2 (binding stubs configured, not provisioned)
- **Runtime**: Workers runtime with compatibility date `2026-09-27` (nodejs_compat enabled by default)
- **CI/CD**: GitHub Actions (requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets)
