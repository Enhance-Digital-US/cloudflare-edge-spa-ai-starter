# Design

## Context

The app is an edge-hosted, client-rendered SPA with a backend-for-frontend (BFF) in the same Worker. A single Worker serves `apps/web/dist` as static assets and runs a Hono API for `/api/*` (`run_worker_first`). The baseline (`scaffold-monorepo`) had one environment, header-based Access auth, and a GitHub Actions deploy. See proposal.md for why this change was needed; the specs define the required behavior. This document records the technical choices behind them and is written after the fact, because the change is already implemented.

## Goals / Non-Goals

**Goals:**
- Keep the single-Worker, single-origin shape. Every new capability lives in the same Worker, so the session cookie stays first-party and there is no CORS.
- Make every environment reproducible from `wrangler.jsonc`, with dry-runs to catch configuration drift.
- Keep CI credential-free and deterministic: no real AI, containers or Cloudflare APIs in tests.

**Non-Goals:**
- Feature flags (Flagship), Analytics Engine, Web Analytics and version-metadata tagging. These were considered and deferred.
- Gradual or percentage rollouts. Releases that change Durable Object classes must use full deploys.
- Exposing sandbox ports or preview URLs (`exposePort`), which would require a wildcard custom domain.
- A UI for browsing past conversations or tasks. The APIs exist, but the chat page only writes history.

## Decisions

**1. Better Auth in the Worker, sessions in D1, instead of Cloudflare Access.**
- Access is workforce identity: billed per seat, with a separate login hop. It could only offer social sign-up by acting as an OIDC relying party in front of Better Auth, which creates a circular dependency (the identity provider's own pages sit behind the gate) and two sessions.
- Better Auth runs inside the BFF, so its session cookie is first-party.
- The auth instance is built per request (`createAuth(env)`), because Workers bindings arrive per request.
- The D1 schema was generated with Better Auth's own migration compiler rather than written by hand, and is committed as `apps/api/migrations/0001_better_auth.sql`.
- Alternative considered: keep Access and add JWKS signature verification. Rejected because it can't support public social sign-up.

**2. Capability flags driven by configuration, not code.**
- Email verification and password reset turn on when `EMAIL_FROM` is set.
- Each social provider turns on when both its credentials exist.
- Sign-up is restricted when `AUTH_ALLOWED_EMAIL_DOMAINS` is non-empty.
- This lets local dev and tests run with email and password only, and lets each environment differ without code changes.
- The domain policy uses a database `user.create.before` hook rather than an endpoint hook, so it covers social sign-up too.

**3. Emails are sent with `waitUntil` from `cloudflare:workers`, not Better Auth's global `backgroundTasks`.**
- The global option makes responses return before database writes complete, which breaks "sign up, then read the session".
- Sending only the emails in the background still avoids timing attacks that reveal whether an account exists.

**4. Previews: a dynamic base URL instead of registering each hostname.**
- Every preview has its own `*.workers.dev` hostname.
- `BETTER_AUTH_ALLOWED_HOSTS` (previews only) switches Better Auth to a per-request base URL limited to those hostname patterns, which are also trusted origins. Unknown hosts fall back to `BETTER_AUTH_URL`.
- Social login is not supported on previews, because OAuth callback URLs must be registered per hostname.

**5. Environments use wrangler `env.staging` plus `env.staging.previews`, with production at the top level.**
- Bindings are not inherited by environments, and previews inherit nothing, so everything is declared three times. Each environment is checked with a dry-run deploy in CI.
- Production deploys pass `--env=""` explicitly.
- Account-global names (Workflows, container applications) get `-staging` variants.

**6. Rate limiting with the Workers `ratelimits` binding instead of Better Auth's built-in limiter.**
- Better Auth's limiter defaults to in-memory storage, which is per-isolate and therefore weak on Workers. The binding is shared at the edge.
- Credential endpoints are keyed by `cf-connecting-ip`, and AI and compute endpoints by user id.
- Limiting is skipped when the IP header is absent. That only happens in local dev and tests; Cloudflare's edge always sets it.
- The AI and compute limiter is attached per route, only on endpoints that spend money. That avoids a Hono gotcha where `/x/*` also matches `/x`, which made one request count twice.

**7. AI Gateway binding path (`env.AI.gateway(id)`) with metadata.**
- This path carries `metadata` (the user id) and `skipCache`, which the previous direct-binding path did not.
- Cost: the adapter's resumable streaming is only available on the direct path. Per-user spend limits matter more.

**8. Model allowlist in `packages/shared`.**
- Client-selected models were an open cost risk.
- The allowlist and the default model live with the request schemas, so the API and the SPA share one source of truth.

**9. Durable Objects for per-entity state.**
- `Conversation` has one instance per `userId:conversationId` name, so ownership is part of the address and no access-control table is needed. Messages are stored in SQLite.
- `clear()` deletes rows rather than calling `storage.deleteAll()`, which would drop the table that the constructor created.
- The assistant reply is captured by wrapping the stream (collecting `TEXT_MESSAGE_CONTENT` deltas) and saved when the stream finishes.

**10. Sandbox: Sandbox SDK 1.0 model, using the raw container API and the Cloudflare-managed image.**
- 1.0 (released 2026-09-30) lets your own Durable Object control the container through `ctx.container` under `scheduling_policy: "durable_object"`.
- Using the managed `cloudflare/debian-trixie` image (Node 24) means no Dockerfile and no Docker for deploys.
- The `@cloudflare/sandbox` package isn't needed, because `Files` isn't used.
- Containers run on `lite` instances with `enableInternet: false`, a 10-second exec timeout via `AbortSignal`, a 64 KB output cap and a 5-minute idle timeout.
- Alternative considered: the 0.x `Sandbox` class. Rejected because it is in maintenance mode until 2026-12-31.

**11. A Workflow for agent tasks.**
- Steps: `generate code` (retried, with a 2-minute timeout), `run in sandbox` (not retried, 1-minute timeout), `save to conversation`.
- Step results are copied into plain objects, because RPC result wrappers aren't serializable step outputs.
- Instance ids are `${userId}-${uuid}`, so the ownership check is a prefix match and needs no lookup table.

**12. Deploys move to Workers Builds, and GitHub Actions only runs checks.**
- Workers Builds handles environment branches and posts preview URLs on PRs without storing Cloudflare credentials in GitHub.
- CI runs `tsr generate` before typecheck, because the route tree is a gitignored generated file.
- Tests set `remoteBindings: false`, so the `ai` binding never opens a remote proxy that would need an API token.
- `@cloudflare/workers-types` was upgraded to v5. That gives the Durable Object container API types and satisfies wrangler's peer range.

## Risks / Trade-offs

- [Open sign-up by default, and email isn't verified until a sender is configured] → Someone can create extra accounts to get around per-user limits, and each account gets its own container. Mitigation: AI Gateway spend limits (per user and a total daily cap), `AUTH_ALLOWED_EMAIL_DOMAINS`, and turning on Email Service. All are documented in the README's production checklist.
- [Durable Object-managed containers are in public beta] → API or behavior may change. Mitigation: the sandbox is isolated behind one class and one route, and returns HTTP 503 when unavailable.
- [Previews run staging's Workflow code] → Workflow changes can't be tested in a preview. Mitigation: keep step bodies thin, unit-test workflow logic with mocked steps, and verify on staging.
- [Preview deploys can't be dry-run] (`wrangler preview` has no `--dry-run`) → Config errors under `previews` may only surface on the first real preview. Mitigation: the staging dry-run validates the `previews` block against the schema.
- [Gateway binding path loses resumable streaming] → A dropped connection mid-reply isn't resumed. Accepted in exchange for per-user attribution.
- [Each environment needs manual setup] (gateways, secrets, resource IDs, Email Service domain) → Deploys fail or chat errors until it's done. Mitigation: the README's production checklist, and the chat stream reports `Please configure AI Gateway` explicitly.
- [Untrusted code execution] → Containers have no Internet access, run as separate per-user instances with strict time and output limits, and are rate limited.

## Migration Plan

1. Archive `scaffold-monorepo` so its specs become the baseline in `openspec/specs/`. This change's MODIFIED and REMOVED deltas depend on it.
2. For each environment, set up the platform prerequisites from the README checklist: the Workers Paid plan, resources, AI Gateways, secrets, and optionally email.
3. Run `pnpm run deploy:staging` and `pnpm run deploy` once to create the Workers, then connect both to Workers Builds.
4. Remove the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets.

**Rollback:** Durable Object class migrations and the container scheduling policy can't be undone with `wrangler rollback`. Fix forward on staging first. Auth rollback is not possible either: Access support has been removed.
