# Spec Delta

## ADDED Requirements

### Requirement: Environment-aware health check
`GET /api/health` SHALL be unauthenticated and SHALL report `status`, the serving `environment` (`development`, `staging` or `production`) and a timestamp.

#### Scenario: Health check on staging
- **WHEN** `GET /api/health` is called on the staging deployment
- **THEN** the response is HTTP 200 with `status: "ok"` and `environment: "staging"`

## MODIFIED Requirements

### Requirement: Typed Cloudflare bindings
The Worker SHALL define a typed `Env` interface that includes every binding and variable the code reads: AI (Workers AI and AI Gateway), D1, KV, R2, the conversation and sandbox Durable Object namespaces, the agent-task Workflow, the auth and AI rate limiters, the Email Service sender, the environment name, and the auth secrets. All route handlers SHALL access bindings through this typed interface.

#### Scenario: Binding type safety
- **WHEN** a route handler accesses `env.AI`, `env.DB`, `env.KV`, `env.BUCKET`, `env.CONVERSATION`, `env.SANDBOX`, `env.AGENT_TASK`, `env.AUTH_RATE_LIMITER`, `env.AI_RATE_LIMITER` or `env.EMAIL`
- **THEN** TypeScript provides correct type information for each binding's API

#### Scenario: Missing binding access
- **WHEN** a route handler references a binding name not declared in the `Env` interface
- **THEN** TypeScript reports a compilation error

### Requirement: Workers runtime compatibility
The Worker SHALL run on the Cloudflare Workers runtime with a compatibility date of `2026-09-27` or later and with the `nodejs_compat` compatibility flag enabled.

#### Scenario: Deployment to Workers
- **WHEN** the Worker is deployed via `wrangler deploy` to any environment
- **THEN** the Worker starts and serves requests without runtime errors
