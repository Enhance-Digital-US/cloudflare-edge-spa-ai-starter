# AGENTS.md

## Architecture

This is a pnpm monorepo that deploys as a single Cloudflare Worker with static assets (SPA).

```
cf-ai-spa/
├── apps/
│   ├── api/          # Hono backend (Worker entry point)
│   └── web/          # React SPA (Vite + TanStack Router)
├── packages/
│   ├── shared/       # Zod schemas and types shared across apps
│   ├── ui/           # shadcn/ui component library
│   └── tsconfig/     # Shared TypeScript configurations
├── wrangler.jsonc    # Single Worker config at root
└── biome.json        # Linter/formatter config
```

### Unified Worker Deployment

The Worker serves both the API and the SPA from a single deployment:

- `main: "apps/api/src/index.ts"` — Hono app handles API routes
- `assets.directory: "apps/web/dist"` — Vite build output served as static assets
- `assets.run_worker_first: ["/api/*"]` — API routes hit the Worker before the SPA fallback
- `assets.not_found_handling: "single-page-application"` — Non-file requests get `index.html` for client-side routing

Without `run_worker_first`, ALL non-file requests (including `/api/*`) return the SPA `index.html` instead of reaching the Worker.

### AI Integration

- **Model**: `@cf/moonshotai/kimi-k2.7-code` (1T MoE, 262k context, code-optimized)
- **Adapter**: `@cloudflare/tanstack-ai` creates a TanStack AI adapter from the `env.AI` binding
- **Gateway**: AI Gateway configured via `gateway: "default"` for rate limiting, caching, and observability
- **Message model**: TanStack AI uses `ModelMessage` with roles `"user" | "assistant" | "tool"` only. System prompts go in a separate `systemPrompts` string array, NOT as messages
- **Streaming**: `chat()` returns a stream, `toHttpResponse()` converts it. On the client, `useChat({ connection: fetchHttpStream("/api/ai/chat") })`
- **Text parts**: `TextPart` has `.content` (not `.text`)
- **Gateway routing**: chat and the agent Workflow use `binding: env.AI.gateway(env.AI_GATEWAY_ID)` with `metadata: { userId }` so AI Gateway spend limits can scope per user. Locally `.dev.vars` sets `AI_GATEWAY_ID=default`
- **Model allowlist**: `ALLOWED_MODELS` / `DEFAULT_MODEL` in `packages/shared/src/schemas/chat.ts`. Never accept arbitrary model strings from clients
- **System prompts are server-owned**: `CHAT_SYSTEM_PROMPT` in `routes/ai.ts`. `ChatRequestSchema` rejects client `"system"` messages and drops the other AG-UI wire roles the client echoes back (`reasoning`, `tool`, `activity`)
- **Cost caps**: `MAX_MESSAGE_CHARS` / `MAX_WIRE_MESSAGES` / `MAX_CONTEXT_CHARS` in `chat.ts`. The rate limiter counts requests, not tokens; `fitToBudget()` (`lib/chat-context.ts`) trims history to `MAX_CONTEXT_CHARS` as a sliding window
- **Persisted conversations**: with a `conversationId`, the Conversation DO's history is authoritative and only the client's new user turn is used, so clients can't rewrite earlier turns

### Durable Objects, Workflows, Containers

- `Conversation` DO (`apps/api/src/durable-objects/conversation.ts`) — SQLite chat history, addressed by `conversationName(userId, conversationId)`
- `CodeSandbox` DO (`code-sandbox.ts`) — owns a Durable Object-managed container (`scheduling_policy: "durable_object"`, public beta) started from the Cloudflare-managed `cloudflare/debian-trixie` image via `this.ctx.container` (Sandbox SDK 1.0 model; the `@cloudflare/sandbox` package is not needed since `Files` isn't used)
- `AgentTaskWorkflow` (`apps/api/src/workflows/agent-task.ts`) — generate → sandbox → save. Step results must be plain serializable objects (copy RPC results)
- All classes are exported from `apps/api/src/index.ts`. DO RPC calls return promises — always `await` them
- Containers need Docker for local dev: `pnpm run dev` passes `--enable-containers=false`; use `pnpm run dev:containers` with Docker running

### API conventions

- Routes are chained (`new Hono<Env>().get(...).post(...)`) and validated with `validate(target, schema)` from `lib/validate.ts` (wraps `@hono/zod-validator`; 400 body is `{ error: z.flattenError(...) }`). Read input with `c.req.valid(target)`
- `index.ts` exports `AppType`; the SPA calls the API through `api` (`hono/client`) in `apps/web/src/lib/api.ts`, typed via TypeScript project references to `apps/api`. Don't hand-write response types in the web app — use `InferResponseType`
- `/api/*` gets `secureHeaders()`, `csrf()`, `bodyLimit` (4 MB) and JSON `notFound`/`onError` handlers. SPA responses never reach the Worker, so their headers (CSP etc.) live in `apps/web/public/_headers`. Keep the CSP's `img-src` free of remote origins: model output is rendered as Markdown

### Authentication

Auth uses Better Auth, running in the Worker. `createAuth(env)` in `apps/api/src/lib/auth.ts` builds the instance once per request (bindings are per-request) and stores it on the Hono context as `c.var.auth`. `/api/auth/*` is handled by `auth.handler`. `authMiddleware` calls `auth.api.getSession()` and sets `c.var.user`. Users and sessions are stored in D1; the schema is in `apps/api/migrations/` (apply with `wrangler d1 migrations apply DB --local|--remote`). The SPA uses `authClient` from `apps/web/src/lib/auth-client.ts`. Social providers turn on only when both their client ID and secret are set. There is no auth bypass; local dev and tests sign up with email and password.

## Conventions

### TypeScript

- All packages use strict mode with `verbatimModuleSyntax`
- TypeScript 7 everywhere (no `baseUrl`; side-effect imports are checked, hence `types: ["vite/client"]` in the web app)
- Worker code extends `@cf-ai-spa/tsconfig/worker` (no DOM types, includes `@cloudflare/workers-types`)
- `apps/api` is a composite project (`tsc -b` emits declarations to `dist/types`); `apps/web` references it so `AppType` resolves. Tests are typechecked via `apps/api/tsconfig.test.json`
- Binding types: `env.ts` is hand-written (more precise than generated types) and checked against `wrangler types` output (`apps/api/worker-configuration.d.ts`, gitignored, regenerated by `pnpm run cf-typegen`, postinstall and typecheck). Adding a binding to `wrangler.jsonc` without adding it to `env.ts` fails typecheck at `BindingsMatchWrangler`
- Web code extends `@cf-ai-spa/tsconfig/web` (DOM types, `react-jsx`)
- Use `.js` extensions in imports (ESM resolution)

### Formatting & Linting

- Biome v2 with recommended rules, 2-space indent, 100-char line width
- Run `pnpm run lint` to check, `pnpm run lint:fix` to auto-fix
- Pre-commit hook via Lefthook runs `biome check --staged`

### UI Components

- Base shadcn components live in `packages/ui/src/components/`
- AI Elements (Conversation, Message, Suggestion, Shimmer) live in `packages/ui/src/components/ai-elements/`
- AI Elements are exported via `@cf-ai-spa/ui/ai-elements` (separate subpath to keep streamdown/shiki out of the main entry chunk)
- AI Elements were hand-ported from the `ai-elements` registry (elements.ai-sdk.dev), with `ai` SDK types replaced by local types for TanStack AI compatibility
- MessageResponse uses Streamdown with `@streamdown/code` and `@streamdown/math` plugins for markdown rendering
- PromptInput was not installed (requires 6+ missing shadcn deps and `ai` file-part types)
- Use `React.ComponentProps<>` for prop types (React 19 ref forwarding)
- Use `cn()` from `packages/ui/src/lib/utils.ts` for className merging
- Use shadcn color tokens: `bg-primary`, `text-muted-foreground`, `border-border`, etc.
- Dark mode uses the `.dark` class on `<html>`, toggled by the theme button

### Testing

- `@cloudflare/vitest-plugin` for API tests (uses miniflare under the hood)
- `vitest` for shared package tests
- Run `pnpm run test` (uses `pnpm -r run test`; there is no vitest workspace — the Cloudflare plugin is incompatible with workspace mode)
- Never call real Workers AI in tests. Mock `@tanstack/ai` with `mockTanstackAi` and call the app through `appFetch` (see the header of `src/__tests__/setup/mock-ai.ts`). `vi.mock` only reaches modules re-imported after `vi.resetModules()`, never `SELF`; in files that reset modules, use `appFetch` for every request (mixing in `SELF` hangs or fails with cross-request I/O errors)
- Test bindings override `.dev.vars` via `miniflare.bindings` in `apps/api/vitest.config.ts`

## Common Commands

```bash
pnpm run dev          # Start Vite (5173) + wrangler (8787), containers disabled (no Docker)
pnpm run dev:containers # Same, with the sandbox container (needs Docker)
pnpm run build        # Build the web app
pnpm run typecheck    # Typecheck all packages
pnpm run lint         # Lint all files
pnpm run lint:fix     # Auto-fix lint issues
pnpm run test         # Run all tests
pnpm run deploy       # Build + deploy production (--env="")
pnpm run deploy:staging # Build + deploy staging
```

## Going Live

`docs/go-live.md` is the runbook for the steps that need Docker, the Cloudflare account, or GitHub (resource creation, AI Gateways, secrets, Workers Builds, previews, production). Don't deploy, create resources, or set secrets without the user's go-ahead.

## Gotchas

- **pnpm 12 build approval**: After `pnpm install`, run `pnpm approve-builds` to allow transitive build scripts
- **Placeholder binding IDs**: `wrangler.jsonc` has `YOUR_D1_DATABASE_ID` / `YOUR_KV_NAMESPACE_ID` (production) and `YOUR_STAGING_*` (staging) — create resources with `wrangler d1 create` / `wrangler kv namespace create` and replace them
- **Environments**: Top level of `wrangler.jsonc` = production (`cf-ai-spa`), `env.staging` = `cf-ai-spa-staging`. Bindings and vars are non-inheritable — when adding a binding, add it to BOTH the top level and `env.staging`. Deploy production with `--env=""` (explicit) and staging with `--env staging`
- **`.dev.vars`**: Needs `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:5173` (the Vite origin, because Better Auth checks `Origin` for CSRF). It is gitignored; copy it from `.dev.vars.example`
- **Better Auth schema changes**: Adding a Better Auth plugin may need new tables. Generate the SQL with `getMigrations(auth.options).compileMigrations()` and save it as a new numbered file in `apps/api/migrations/`. Never edit an applied migration
- **API tests**: D1 migrations are applied in `src/__tests__/setup/apply-migrations.ts`. Use `signUpAndGetCookie()` from `src/__tests__/setup/session.ts` for authenticated requests
- **Bindings are declared twice**: every binding/var exists at the top level (production) AND under `env.staging`. DO bindings and Workflows also go under `env.staging.previews`. Workflow names and container `name`s are account-global, so staging uses `-staging` names. DO-managed containers cannot be declared under `previews` (wrangler rejects it)
- **DO migrations are append-only**: add a new `tag` to `migrations` (both envs) for class changes; such releases must use `wrangler deploy`, not `versions upload`
- **`storage.deleteAll()` in a SQLite DO drops its tables too** — delete rows with SQL instead (see `Conversation.clear()`)
- **workers-types v5**: the API uses `@cloudflare/workers-types@5` (needed for the DO container API and to satisfy wrangler's peer range)
- **Workflow tests**: mock steps with `introspectWorkflow(env.AGENT_TASK)` + `mockStepResult` (see `src/__tests__/agent.test.ts`) — never call real AI or containers in tests
- **Vitest workspace**: Don't add a `vitest.workspace.ts` — the Cloudflare plugin's `cloudflare:test` module isn't found when orchestrated via workspace mode. Use `pnpm -r run test` instead
- **Vitest 4**: stay on vitest 4.1 until a `@cloudflare/vitest-plugin` release supporting vitest 5 clears pnpm's `minimumReleaseAge` without depending on prerelease packages
- **Rate limits**: Better Auth's built-in limiter is disabled (its in-memory store is per isolate on Workers). New credential- or email-sending auth endpoints must be added to the `AUTH_RATE_LIMITER` path list in `index.ts`
- **Security overrides**: `pnpm-workspace.yaml` `overrides` patch vulnerable transitive deps (katex, shell-quote, sharp). Remove each once its parent ships a fixed range; CI runs `pnpm audit --prod --audit-level high`
- **Node**: `.node-version` (24) is used by CI; `engines` requires >=22
