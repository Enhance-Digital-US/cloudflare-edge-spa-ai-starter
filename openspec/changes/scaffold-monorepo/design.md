# Design

## Context

This is a greenfield monorepo template — there is no existing codebase. See proposal.md for motivation. The design below covers the key architectural decisions: how packages connect, how the unified Worker model works, how AI flows through the system, and how tooling is configured.

The target runtime is Cloudflare Workers with compatibility date `2026-09-27`, which enables `nodejs_compat` by default.

## Goals / Non-Goals

**Goals:**
- Every package builds and type-checks independently
- A single `wrangler deploy` deploys the full application (API + SPA)
- Developer can `pnpm dev` from root and have both frontend and backend running with HMR
- AI streaming works end-to-end from Workers AI through Hono to React hooks
- Auth middleware is a single file swap, not a rewrite

**Non-Goals:**
- SSR or server-side rendering — this is a pure SPA
- Database provisioning or migration tooling — bindings are configured but resources are created by the developer
- Turborepo or other build orchestrators — pnpm scripts handle the 5-package scope
- Multi-environment config (staging/prod) — single deployment target, extendable later
- WebSocket or Durable Objects patterns — configured as binding stubs only

## Decisions

### 1. Root wrangler.jsonc with unified Worker entry

**Choice**: Single `wrangler.jsonc` at monorepo root. `main` points to `apps/api/src/index.ts`. `assets.directory` points to `apps/web/dist`.

**Why over per-package wrangler configs**: The unified model means one deployment command, one config to manage, and the `assets` binding automatically serves the SPA. The alternative (wrangler in `apps/api` with relative path `../web/dist`) couples deployment to directory structure and makes CI scripts messier.

**Trade-off**: Root config means `wrangler dev` must be run from root, not from `apps/api/`. This is handled by the root `dev` script.

### 2. Vite dev server + wrangler dev (no Cloudflare Vite plugin)

**Choice**: `apps/web` uses a standard Vite dev server with a proxy for `/api/*`. `wrangler dev` runs the Worker separately. Both launched concurrently via the root `dev` script.

**Why not `@cloudflare/vite-plugin`**: The plugin is designed for projects where Vite IS the Worker (SSR apps, React Router v7). Here the SPA is a pure client build — it doesn't need workerd during development. The Worker runs separately via `wrangler dev`, which provides full binding simulation. Keeping them separate gives faster HMR for the frontend (standard Vite, no workerd overhead) and real Workers runtime for the backend.

**Alternative considered**: Single Vite process with the Cloudflare plugin. Rejected because it adds complexity for no gain in a pure SPA + separate API architecture.

### 3. TanStack AI with @cloudflare/tanstack-ai adapter

**Choice**: `@tanstack/ai` + `@cloudflare/tanstack-ai` for the AI layer. `@tanstack/ai-react` for React hooks.

**Why over Vercel AI SDK**: TanStack AI has a first-party Cloudflare adapter maintained by Cloudflare. It uses the `env.AI` binding directly (no API keys for Workers AI models), supports AI Gateway natively, runs on the Workers runtime without Node.js 22+ requirements, and aligns with the TanStack ecosystem already in use (Router). See the exploration conversation for the full comparison.

**Data flow**:
```
React (useChat) --POST--> Hono /api/ai/chat --env.AI.run()--> Workers AI / AI Gateway
     ^                                                              |
     |_______________ streaming tokens (SSE) _______________________|
```

### 4. Auth middleware as a typed context pattern

**Choice**: Hono middleware that validates auth and sets a typed `user` on Hono's context (`c.set("user", ...)`). Route handlers access `c.get("user")`. Default implementation validates Cloudflare Access JWT.

**Why this pattern**: Hono's context variables are typed via generics. Defining `type Variables = { user: User }` on the Hono app means route handlers get type-safe access to the user regardless of which middleware sets it. Swapping from Cloudflare Access to better-auth means replacing one middleware file — the `User` type and `c.get("user")` calls stay unchanged.

**Alternative considered**: Separate auth service or external auth provider from day one. Rejected because Cloudflare Access is zero-config for deployed Workers (just configure in Zero Trust dashboard), and adding a third-party auth provider to a starter template adds setup friction that isn't needed on day one.

### 5. packages/tsconfig as a workspace package

**Choice**: Separate `packages/tsconfig` package with `tsconfig.base.json`, `tsconfig.web.json`, `tsconfig.worker.json`, and `tsconfig.shared.json`.

**Why over root tsconfig.base.json**: The package model makes TypeScript configs versionable and explicitly depended on. Each consuming package declares `"extends": "@cf-ai-spa/tsconfig/web"` (or `/worker`, `/shared`). The three presets enforce runtime boundaries at the type level — DOM types are absent from Worker configs, Workers types are absent from shared configs. This catches cross-runtime mistakes at compile time, not at deployment.

**Key settings in base**:
- `strict: true`, `exactOptionalPropertyTypes: true`
- `module: "ESNext"`, `moduleResolution: "bundler"`
- `target: "ES2022"`
- `verbatimModuleSyntax: true`
- `skipLibCheck: true` (for speed in monorepo)

### 6. Biome over ESLint + Prettier

**Choice**: Biome for both linting and formatting, single `biome.json` at root.

**Why**: 10-100x faster than ESLint+Prettier in a monorepo. Covers the essential rules (unused vars, no-explicit-any, consistent imports, formatting). The plugin ecosystem gap (no `eslint-plugin-react-hooks` equivalent) is acceptable for a starter template — Biome's React support covers the most common rules, and users can add ESLint alongside later if needed.

### 7. Vitest workspace with Workers pool

**Choice**: Root `vitest.workspace.ts` defines two project groups: `apps/api` uses `@cloudflare/vitest-pool-workers` pool, everything else uses the default Node pool.

**Why two pools**: Worker tests need the miniflare environment for binding stubs. Frontend and shared tests run fine in Node. The workspace config lets `pnpm test` from root run both groups seamlessly.

### 8. shadcn/ui in packages/ui

**Choice**: `packages/ui` houses shadcn components installed via the shadcn CLI, with Tailwind CSS v4 and the `cn()` utility (clsx + tailwind-merge).

**Why a separate package**: Components are consumed by `apps/web` and potentially future apps. Keeping them in a shared package avoids duplication. The shadcn CLI supports custom component paths, so `pnpm dlx shadcn@latest add button` can target `packages/ui/src/components/`.

### 9. Zod schemas in packages/shared

**Choice**: Request/response schemas defined with Zod in `packages/shared/src/schemas/`. Types are inferred from schemas (not hand-written interfaces).

**Why**: Zod works in both browser and Workers runtimes. Defining schemas once in `packages/shared` gives end-to-end type safety: the API validates incoming data with the same schema the frontend uses to type its fetch calls. Zod's `.infer<>` eliminates type/schema drift.

## Risks / Trade-offs

- **[Biome plugin gap]** → Biome lacks some niche ESLint plugins (a11y, hooks exhaustive-deps). Mitigation: users can add ESLint as a complement for specific rules. The template includes the most impactful checks.
- **[Root wrangler.jsonc coupling]** → Running `wrangler dev` or `wrangler deploy` from anywhere other than root requires `--config` flag. Mitigation: all wrangler commands are wrapped in root package.json scripts.
- **[AI Gateway requires dashboard setup]** → AI Gateway ID must be created in the Cloudflare dashboard before gateway routing works. Mitigation: the template documents this in a README and the gateway config is optional (requests work without it, just without caching/logging).
- **[Cloudflare Access requires Zero Trust setup]** → Auth middleware does nothing useful until Cloudflare Access is configured for the domain. Mitigation: the auth middleware is applied only to explicitly protected routes, not globally. Unprotected routes work immediately.
- **[TanStack AI is pre-1.0]** → At version 0.57.x, the API surface may still change. Mitigation: the template pins a specific version. The Cloudflare adapter is maintained by Cloudflare, reducing abandonment risk.
