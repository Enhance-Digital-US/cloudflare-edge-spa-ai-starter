# Tasks

## 1. CI and tooling baseline

- [x] 1.1 Add `@tanstack/router-cli` and run `tsr generate` before `tsc` in the web `typecheck` script; verify `pnpm run typecheck` passes with `routeTree.gen.ts` deleted
- [x] 1.2 Expand `.github/workflows/ci.yml` with build, production and staging `wrangler deploy --dry-run`, and concurrency cancellation, running on PRs and pushes to `main`; verify every step passes locally
- [x] 1.3 Delete `.github/workflows/deploy.yml` (backup kept outside the repo); verify `.github/workflows/` contains only `ci.yml`
- [x] 1.4 Set `remoteBindings: false` in `apps/api/vitest.config.ts`; verify `pnpm run test` and both dry-runs succeed with a throwaway `HOME` and no `CLOUDFLARE_*` variables
- [x] 1.5 Upgrade `@cloudflare/workers-types` to v5; verify `pnpm peers check` reports no issues and typecheck passes

## 2. Environments

- [x] 2.1 Add `env.staging` to `wrangler.jsonc` with its own Worker name, D1, KV, R2, AI and vars, plus an `ENVIRONMENT` var for each environment; verify both dry-runs list identical binding names
- [x] 2.2 Make the production deploy explicit (`wrangler deploy --env=""`) and add `deploy:staging`; verify no multi-environment warning on the production dry-run
- [x] 2.3 Return `environment` from `GET /api/health`; verify the health test and `curl` on local dev return `development`
- [x] 2.4 Document environments, the Workers Builds settings for each Worker and migration-first deploy commands in the README and AGENTS.md; verify the documented commands match `package.json` scripts

## 3. Authentication (Better Auth)

- [x] 3.1 Generate the Better Auth SQLite schema into `apps/api/migrations/0001_better_auth.sql` and set `migrations_dir` for both environments; verify `wrangler d1 migrations apply DB --local` succeeds
- [x] 3.2 Add the `createAuth(env)` factory, mount `/api/auth/*`, and replace the Access middleware with a session check; remove `BYPASS_AUTH`; verify the auth tests (401 without a session, forged cookie, legacy header ignored, session after sign-up, 401 after sign-out)
- [x] 3.3 Enable social providers only when both credentials are set, and add `GET /api/auth/providers`; verify the providers test returns an empty capability set in tests
- [x] 3.4 Add the `AUTH_ALLOWED_EMAIL_DOMAINS` database hook; verify unit tests (exact, case-insensitive, no subdomain or suffix match) and the hook rejecting a blocked domain
- [x] 3.5 Add email verification and password reset through the `send_email` binding, gated on `EMAIL_FROM` and sent in `waitUntil`; verify that with `EMAIL_FROM` set, sign-up returns no token and sign-in is refused until verification
- [x] 3.6 Add `BETTER_AUTH_ALLOWED_HOSTS` dynamic base URL support for previews; verify sign-up from a preview hostname succeeds and a foreign origin gets 403
- [x] 3.7 Build the `/sign-in` (capability-driven, safe redirect, check-your-email state), `/reset-password`, `/chat` guard and header user menu in the SPA; verify in a browser that `/chat` redirects to `/sign-in?redirect=/chat` and sign-up lands on `/chat` with the email in the header
- [x] 3.8 Update the README auth model, local auth and `.dev.vars.example`; verify a fresh `.dev.vars` copied from the example lets `pnpm run dev` sign up locally

## 4. AI cost and abuse controls

- [x] 4.1 Add the `ALLOWED_MODELS` and `DEFAULT_MODEL` allowlist to `ChatRequestSchema`; verify shared tests (allowlisted model accepted, other model rejected) and a live 400 for a non-allowlisted model
- [x] 4.2 Route chat through `env.AI.gateway(AI_GATEWAY_ID)` with `metadata: { userId, environment }` and `skipCache`, with a gateway per environment and `default` locally; verify a live streamed reply locally
- [x] 4.3 Add `ratelimits` bindings (auth by IP 10/60s, AI by user 20/60s) with distinct namespaces for production, staging and previews; verify the rate-limit tests (11th sign-in → 429, other IP unaffected, 21st chat → 429)
- [x] 4.4 Attach the AI limiter only to compute-spending routes and count each request once; verify the regression test (first task-creation 429 on the 21st request, status polling not limited)
- [x] 4.5 Enable observability (logs, traces at 10% in production and 100% in staging, Issues); verify both dry-runs succeed with the `observability` block

## 5. Conversation history

- [x] 5.1 Implement the `Conversation` Durable Object (SQLite, append, list, clear by row delete) with the migration tag `v1`; verify the DO test (ordering, clear then reuse)
- [x] 5.2 Persist chat turns when `forwardedProps.conversationId` is present (user turn first, assistant reply when the stream ends), and send a per-visit conversation id from the chat page; verify the isolation test and a live local check that both turns are saved
- [x] 5.3 Add `GET /api/conversations/:id/messages` and `DELETE /api/conversations/:id` with id validation; verify 401 and 400 tests

## 6. Code sandbox and agent tasks

- [x] 6.1 Implement the `CodeSandbox` Durable Object on the managed `cloudflare/debian-trixie` image (lite, no Internet, 10s timeout, 64 KB cap, 5-minute idle) with a `durable_object` container per environment; verify both dry-runs list `SANDBOX`
- [x] 6.2 Add `POST /api/sandbox/exec` with validation, rate limiting and a 503 when containers are unavailable; verify the 401 and 400 tests and a live 503 under `pnpm run dev`
- [x] 6.3 Implement `AgentTaskWorkflow` (generate retried, sandbox not retried, save to conversation) with environment-specific Workflow names; verify the mocked-step test reaches `complete` and writes the conversation
- [x] 6.4 Add `POST /api/tasks` (202) and owner-scoped `GET /api/tasks/:id`; verify the 401 and cross-user 404 tests and a live run reporting `errored` without containers
- [x] 6.5 Make containers opt-in for local dev (`pnpm run dev` vs `dev:containers`); verify `pnpm run dev` starts without a Docker daemon
- [x] 6.6 Declare all bindings, vars, Durable Objects and the Workflow under `env.staging.previews`; verify the staging dry-run validates the `previews` block

## 7. Verification still pending (needs platform access)

Exact commands and pass criteria for each task: [`docs/go-live.md`](../../../docs/go-live.md).

- [ ] 7.1 With Docker running, run `pnpm run dev:containers` and execute `console.log(1 + 2)`, an infinite loop and an outbound `fetch` via `/api/sandbox/exec`; verify `3\n`, `timedOut: true` and a network failure respectively
- [ ] 7.2 Complete the README production checklist for staging (Paid plan, resources, `cf-ai-spa-staging` gateway with spend limits, secrets, preview subdomain and secrets) and deploy; verify `/api/health` reports `staging` and a chat reply streams
- [ ] 7.3 Open a PR and verify its preview: sign-up succeeds on the preview hostname, chat works, and no production resource receives traffic
- [ ] 7.4 Run an agent task on staging end to end; verify it reaches `complete` with real sandbox output
- [ ] 7.5 Complete the production checklist and promote to the `production` branch; verify `/api/health` reports `production` and AI Gateway shows per-user metadata
