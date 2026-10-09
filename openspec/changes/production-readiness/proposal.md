# Proposal

## Why

The scaffold could not be safely deployed or operated. The AI endpoint trusted an unverified JWT that anyone could forge on the `workers.dev` hostname. There was one environment, no observability and no abuse or cost controls. CI failed on a clean checkout, and the planned social sign-up and agent features (stateful chat, code execution, long-running tasks) had nowhere to live. This change makes the template production-ready on Cloudflare and records the behavior that was built.

## What Changes

- **BREAKING** Replace Cloudflare Access JWT auth with first-party session auth in the Worker. Users sign up with email and password or GitHub/Google, and sessions are stored in D1. The `CF-Access-JWT-Assertion` header is no longer accepted, and the local `BYPASS_AUTH` flag is removed.
- Add a configurable sign-up policy (an allowlist of email domains), email verification and password reset (when a sender is configured), and an endpoint that reports which auth methods are available.
- Add per-IP rate limiting on credential endpoints and per-user rate limiting on AI, sandbox and task-creation endpoints.
- Add `staging` and `production` environments as separate Workers with separate resources, plus PR previews that run against staging resources.
- **BREAKING** Move deploys from GitHub Actions to Cloudflare Workers Builds. GitHub Actions only runs checks: lint, typecheck, tests, build and dry-run deploys. It needs no Cloudflare credentials. D1 migrations are applied before every deploy.
- Route AI traffic through a per-environment AI Gateway with the user's id attached for per-user spend limits. Turn response caching off. Restrict clients to an allowlist of models.
- Enable logs, sampled traces and Issues for every environment.
- Persist chat history per user and conversation.
- Add an isolated per-user code sandbox (a container with no Internet access) and a durable agent-task workflow: generate code, run it in the sandbox, save the result.
- The health check reports which environment is serving the request.

## Capabilities

### New Capabilities
- `deployment-environments`: Production, staging and preview environments, their resource isolation, and the configuration rules that keep them in sync.
- `observability`: Logging, tracing and failure grouping requirements for each environment.
- `rate-limiting`: Per-IP and per-user request limits and how limited requests are answered.
- `conversation-history`: Server-side storage of chat turns per user and conversation, and the API to read and clear them.
- `code-sandbox`: Isolated execution of user or model-provided JavaScript, with limits on time, output and network access.
- `agent-tasks`: Durable multi-step tasks (generate, execute, record) with owner-scoped status.

### Modified Capabilities
- `auth-middleware`: Session-based auth replaces Cloudflare Access JWT validation. Adds sign-up policy, email verification, password reset, capability discovery and support for preview hostnames.
- `ci-cd-pipeline`: CI checks expand to include build and dry-run deploys and run without credentials. Deploys move to Workers Builds with migrations, and the GitHub deploy workflow and its secrets are removed.
- `ai-integration`: Per-environment gateway with user attribution and no caching. Multi-provider selection is replaced by a model allowlist, and chat turns can be persisted.
- `api-worker`: The typed bindings cover the new stateful and operational bindings. The health check reports the environment.
- `dev-tooling`: Tests run fully locally with migrations applied and no remote bindings. Local development works without Docker.
- `spa-frontend`: Adds sign-in, sign-up and password-reset screens, a protected chat route, and a per-session conversation id.

## Impact

- **Code:** auth, rate limiting, Durable Objects, Workflows and new routes in `apps/api`. New auth screens in `apps/web`. The model allowlist and request schemas in `packages/shared`.
- **Config:** `wrangler.jsonc` gains environments, previews, rate limiters, Email Service, Durable Objects, a container and a Workflow. `.dev.vars` and the CI workflow change, and `.github/workflows/deploy.yml` is removed.
- **APIs:**
  - New: `/api/auth/*`, `/api/auth/providers`, `/api/conversations/:id`, `/api/sandbox/exec` and `/api/tasks`.
  - Changed: `/api/ai/chat` now requires a session cookie, rejects models outside the allowlist, and accepts `forwardedProps.conversationId`.
- **Dependencies:** adds `better-auth`, `@tanstack/router-cli` and `@cloudflare/workers-types@5`.
- **Platform:** containers require the Workers Paid plan. Durable Object-managed containers are in public beta.
- **Operations:** before going live, each environment needs AI Gateways, secrets, resource IDs and, optionally, an Email Service domain set up by hand.
