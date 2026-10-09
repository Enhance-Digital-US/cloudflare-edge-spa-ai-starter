# CF AI SPA

A production-ready monorepo starter template for building AI-powered single-page applications on Cloudflare.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TanStack Router (file-based), Vite |
| Backend | Hono on Cloudflare Workers |
| AI | Workers AI (Kimi K2.7 Code), TanStack AI, AI Gateway |
| Design | shadcn/ui, Tailwind CSS v4 |
| Storage | D1 (SQL), KV (key-value), R2 (objects) |
| Stateful | Durable Objects (SQLite), Workflows, Containers (Sandbox SDK 1.0 model) |
| Auth | Better Auth (email/password + GitHub/Google), sessions in D1, Email Service |
| Ops | Workers Logs + Traces + Issues, Rate Limiting bindings, AI Gateway spend limits |
| Tooling | Biome (lint/format), Vitest, Lefthook, GitHub Actions |
| Package Manager | pnpm 12 with workspaces |

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 12 (`corepack enable && corepack prepare pnpm@12.6.0 --activate`)
- A Cloudflare account (for Workers AI and deployment)

### Setup

```bash
# Install dependencies
pnpm install

# Approve build scripts (required by pnpm 12)
pnpm approve-builds

# Create local dev secrets
cp .dev.vars.example .dev.vars

# Login to Cloudflare (needed for Workers AI)
pnpm exec wrangler login
```

### Create Cloudflare Resources

The `wrangler.jsonc` has placeholder IDs that need to be replaced. Production (top level) and staging (`env.staging`) each get their own resources:

```bash
# Production
pnpm exec wrangler d1 create cf-ai-spa-db                    # → database_id
pnpm exec wrangler kv namespace create KV                    # → kv_namespaces id
pnpm exec wrangler r2 bucket create cf-ai-spa-bucket

# Staging
pnpm exec wrangler d1 create cf-ai-spa-db-staging            # → env.staging database_id
pnpm exec wrangler kv namespace create KV --env staging      # → env.staging kv_namespaces id
pnpm exec wrangler r2 bucket create cf-ai-spa-bucket-staging
```

### Development

```bash
# Start both frontend (Vite :5173) and backend (Wrangler :8787) — no Docker needed
pnpm run dev

# Same, but with the code sandbox container enabled (requires Docker running)
pnpm run dev:containers
```

`pnpm run dev` disables containers, so everything except `/api/sandbox/*` and the sandbox step of agent tasks works without Docker; those return 503 / error locally. Use `dev:containers` to exercise them.

Open http://localhost:5173 — the Vite dev server proxies `/api/*` requests to the Worker on port 8787.

### Local Auth

Auth is real locally too, with no bypass flag. Apply the D1 schema once, then sign up with email and password at http://localhost:5173/sign-in:

```bash
pnpm exec wrangler d1 migrations apply DB --local
```

`.dev.vars` needs `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL=http://localhost:5173`. To test social login, create OAuth apps with the callback URLs in `.dev.vars.example` and set the matching `*_CLIENT_ID` / `*_CLIENT_SECRET`. A provider is only enabled when both values are present.

## Project Structure

```
cf-ai-spa/
├── apps/
│   ├── api/                    # Hono backend Worker
│   │   ├── migrations/         # D1 migrations (Better Auth schema)
│   │   └── src/
│   │       ├── index.ts        # App entry, route mounting, DO/Workflow exports
│   │       ├── env.ts          # Typed Cloudflare bindings
│   │       ├── lib/            # Better Auth factory, email sending
│   │       ├── middleware/     # Session auth, rate limiting
│   │       ├── routes/         # API route handlers
│   │       ├── durable-objects/# Conversation (chat history), CodeSandbox (container)
│   │       └── workflows/      # AgentTaskWorkflow
│   └── web/                    # React SPA
│       └── src/
│           ├── main.tsx        # React entry
│           ├── lib/            # Better Auth client
│           ├── routes/         # File-based routes (chat, sign-in, reset-password)
│           └── styles.css      # Tailwind v4 + shadcn tokens
├── packages/
│   ├── shared/                 # Zod schemas & types (incl. model allowlist)
│   ├── ui/                     # shadcn/ui components
│   └── tsconfig/               # Shared TS configs
├── wrangler.jsonc              # Worker config: production (top level) + env.staging
├── biome.json                  # Biome linter/formatter
├── .mcp.json                   # MCP servers for Claude Code
└── .dev.vars                   # Local-only secrets (gitignored)
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start dev servers (Vite + Wrangler), containers disabled |
| `pnpm run dev:containers` | Same, with the sandbox container (needs Docker) |
| `pnpm run build` | Build the web app |
| `pnpm run typecheck` | Typecheck all packages |
| `pnpm run lint` | Lint all files with Biome |
| `pnpm run lint:fix` | Auto-fix lint issues |
| `pnpm run format` | Format all files |
| `pnpm run test` | Run all tests |
| `pnpm run deploy` | Build and deploy production |
| `pnpm run deploy:staging` | Build and deploy staging |
| `pnpm run preview` | Build and preview locally |

## Deployment

### Production checklist (one-time, per environment)

> **Step-by-step commands and verification for all of this are in [`docs/go-live.md`](docs/go-live.md).**

These can't live in the repo. Do each for **production** and **staging**:

1. **Workers Paid plan.** Required for Containers (the code sandbox).
2. **Create resources and replace the `YOUR_*` IDs** in `wrangler.jsonc` (see [Create Cloudflare Resources](#create-cloudflare-resources)).
3. **Create the AI Gateways** `cf-ai-spa-production` and `cf-ai-spa-staging` (dashboard → AI → AI Gateway). Without them, chat fails with `Please configure AI Gateway`. On each gateway:
   - Add **spend limits**, scoped per user with the `userId` metadata dimension that every request sends.
   - Add a total daily cap.
   - Turn caching off.
4. **Set the auth secrets**: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, plus OAuth credentials if you use them (see [Auth Model](#auth-model)).
5. **Email (optional, recommended).** Run `wrangler email sending enable <your-domain>`, then set `EMAIL_FROM` in `vars`. This turns on email verification and password reset.
6. **Sign-up policy.** `AUTH_ALLOWED_EMAIL_DOMAINS` is empty, so **sign-up is open to anyone**. Set it to restrict sign-up to specific domains.
7. **Rate limits.** `namespace_id`s `1001`/`1002` (production), `2001`/`2002` (staging) and `3001`/`3002` (previews) must not collide with other Workers in the account.
8. **PR previews** (staging Worker only):
   - Replace `YOUR_SUBDOMAIN` in `env.staging.previews.vars.BETTER_AUTH_ALLOWED_HOSTS` with your workers.dev subdomain.
   - Set the preview base secrets once:
     ```bash
     pnpm exec wrangler preview base-config secret put BETTER_AUTH_SECRET --env staging
     pnpm exec wrangler preview base-config secret put BETTER_AUTH_URL --env staging   # the staging URL (fallback)
     ```
   - Previews inherit nothing from staging, so `env.staging.previews` repeats every binding, pointed at staging resources.
   - Email/password sign-in works on previews. Social login doesn't, because OAuth callback URLs must be registered per hostname.

### Environments

| Environment | Worker | Resources | `ENVIRONMENT` var |
|---|---|---|---|
| Local | `wrangler dev` | Local miniflare simulation | `development` (from `.dev.vars`) |
| Staging | `cf-ai-spa-staging` | `*-staging` D1 / KV / R2 | `staging` |
| Production | `cf-ai-spa` | Top-level D1 / KV / R2 | `production` |

`GET /api/health` returns the `environment`, so you can confirm which deployment you're hitting.

Bindings and vars are **non-inheritable** in Wrangler: anything added at the top level of `wrangler.jsonc` must also be added under `env.staging`, or the staging Worker deploys without it. Run `pnpm exec wrangler deploy --dry-run --env staging` to check the binding list.

### Manual

```bash
pnpm run deploy           # production (wrangler deploy --env="")
pnpm run deploy:staging   # staging    (wrangler deploy --env staging)
```

### CI/CD (Workers Builds)

Deploys run through [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), Cloudflare's Git integration, so no Cloudflare credentials are stored in GitHub. Each environment is its own Worker connected to the same repo:

1. Run `pnpm run deploy:staging` and `pnpm run deploy` once to create both Workers, then set each one's auth secrets (see [Auth Model](#auth-model)).
2. In the dashboard, connect the GitHub repo to **each** Worker (**Settings → Builds**):

| Setting | `cf-ai-spa-staging` | `cf-ai-spa` |
|---|---|---|
| Branch | `main` | `production` |
| Build command | `pnpm run build` | `pnpm run build` |
| Deploy command | `npx wrangler d1 migrations apply DB --remote --env staging && npx wrangler deploy --env staging` | `npx wrangler d1 migrations apply DB --remote --env="" && npx wrangler deploy --env=""` |
| Preview builds | On: `npx wrangler preview --env staging` | Off |

Durable Object class changes (new, renamed or deleted classes in `migrations`) must ship with `wrangler deploy`, which is what both deploy commands use. Never switch production to `wrangler versions upload` for a release that changes DO classes.

Merges to `main` deploy to staging. Promote to production by fast-forwarding the `production` branch to a tested commit. PR previews use **staging** resources, so they never touch production data.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests, build, and a `wrangler deploy --dry-run` for both environments on PRs and pushes to `main`. It never deploys. Make it a required status check in branch protection.

## Architecture Notes

### Pattern: Edge-hosted CSR SPA with a Colocated Serverless BFF

The app follows an **edge-hosted, client-side-rendered (CSR) SPA with a colocated serverless Backend-for-Frontend (BFF)** pattern:

- **Edge-hosted**: The Vite build output (`apps/web/dist`) is served as static assets from Cloudflare's global network, so the HTML/JS/CSS shell comes from a location close to the user rather than from an origin server.
- **CSR SPA**: The server never renders React. Every non-file, non-API request falls back to `index.html` (`not_found_handling: "single-page-application"`), and TanStack Router handles routing in the browser.
- **Colocated**: The Hono API (`apps/api`) ships in the same Worker and the same deployment as the SPA. Both share one origin, so there's no CORS setup, the auth session cookie is first-party, and the frontend and backend always deploy at matching versions.
- **Serverless BFF**: The Worker is a thin backend built for this one frontend rather than a general-purpose API. It holds the bindings and secrets (Workers AI, D1, KV, R2), validates requests with the shared Zod schemas, enforces auth, and streams AI responses back. None of this runs in the browser.

```
Browser ──► Cloudflare edge
              ├─ /api/*        ──► Worker (Hono BFF) ──► AI · D1 · KV · R2
              ├─ static files  ──► apps/web/dist assets
              └─ anything else ──► index.html (client-side routing)
```

**Trade-offs:** This setup is cheap and simple to run: one deploy, one origin, no servers, and type sharing through `@cf-ai-spa/shared`. In exchange, the first paint is an empty shell until the JS bundle loads, so there's no SSR/SEO benefit. That fits authenticated, app-like UIs such as a chat interface. If you need server rendering, consider a framework like React Router or TanStack Start on Workers.

### Unified Worker

Both the API and SPA are served from a single Cloudflare Worker. The `run_worker_first: ["/api/*"]` config ensures API routes reach the Hono app instead of being intercepted by the SPA fallback.

### AI Integration

The chat endpoint at `/api/ai/chat` uses TanStack AI with the `@cloudflare/tanstack-ai` adapter:

1. Client sends messages via `useChat` hook with `fetchHttpStream`
2. Worker validates with Zod schemas from `@cf-ai-spa/shared`
3. `createWorkersAiChat` creates an adapter bound to `env.AI`
4. AI Gateway (`gateway: "default"`) handles caching and rate limiting
5. Response streams back via `toHttpResponse`

### Stateful & Agent Features

| Piece | What it does | API |
|---|---|---|
| `Conversation` Durable Object | Chat history in SQLite, one instance per `userId:conversationId`. The chat page sends a `conversationId` (via `forwardedProps`), and the API saves the user turn and the streamed assistant reply | `GET /api/conversations/:id/messages`, `DELETE /api/conversations/:id` |
| `CodeSandbox` Durable Object + Container | One Linux container per user (Cloudflare-managed `cloudflare/debian-trixie`, Node 24, `lite`, **no Internet**). Runs `node -e <code>` with a 10s timeout and 64KB output cap, and stops after 5 minutes idle | `POST /api/sandbox/exec` `{ code }` |
| `AgentTaskWorkflow` | Durable steps: **generate code** (AI, retried) → **run in sandbox** (not retried, since generated code may have side effects) → **save to conversation**. Task ids are prefixed with the owner's user id, which is used as the ownership check | `POST /api/tasks` `{ prompt, conversationId? }` → `GET /api/tasks/:id` |

All of these require a session. Sandbox and task requests share the per-user `AI_RATE_LIMITER` with chat. Clients can only pick models in `ALLOWED_MODELS` (`packages/shared`).

**Previews:** each `wrangler preview --env staging` gets its own Durable Object namespaces, but Workflows aren't created per preview. `AGENT_TASK` in a preview runs the **staging** Workflow code, so Workflow changes are first tested for real on staging.

### Auth Model

Auth is handled by [Better Auth](https://better-auth.com), running inside the Worker:

- `/api/auth/*` is served by Better Auth (`apps/api/src/lib/auth.ts`): email/password sign-up and sign-in, plus GitHub and Google when their credentials are set.
- Users, accounts and sessions live in D1. The schema is in `apps/api/migrations/`.
- `authMiddleware` checks the session cookie with `auth.api.getSession()` and returns 401 if there's no valid session. It protects `/api/ai/*`.
- The session cookie is `HttpOnly` and first-party, since the SPA and API share an origin. Better Auth rejects cross-origin `POST`s to its endpoints (CSRF protection), using `BETTER_AUTH_URL` as the trusted origin.
- **Sign-up policy:** `AUTH_ALLOWED_EMAIL_DOMAINS` (comma-separated) restricts which email domains can create accounts, for both email and social sign-up, via a Better Auth database hook. Empty means open sign-up.
- **Email verification and password reset** turn on automatically when `EMAIL_FROM` is set. Emails go through the Email Service `send_email` binding inside `waitUntil`, so response timing doesn't reveal whether an account exists. `/api/auth/providers` tells the SPA which social providers, verification and reset are available, and the sign-in page shows only those.
- **Rate limits:** `AUTH_RATE_LIMITER` allows 10 requests per minute per client IP on sign-in, sign-up and reset. `AI_RATE_LIMITER` allows 20 per minute per user on chat, sandbox and tasks.
- The `/chat` route guard in the SPA only controls what the user sees. The API enforces auth whatever the client does.

**Per-environment secrets:** each environment needs its own `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, and its own OAuth apps, because callback URLs are per-domain:

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env staging
pnpm exec wrangler secret put BETTER_AUTH_URL --env staging     # e.g. https://cf-ai-spa-staging.<subdomain>.workers.dev
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env=""      # production
pnpm exec wrangler secret put BETTER_AUTH_URL --env=""
```

## Adding Features

Claude Code skills are included for common workflows:

- **Add a UI component**: Follow `.claude/skills/add-ui-component/SKILL.md`
- **Add an API route**: Follow `.claude/skills/add-api-route/SKILL.md`
- **Add a Cloudflare binding**: Follow `.claude/skills/add-binding/SKILL.md`

## License

MIT
