# Spec Delta

## ADDED Requirements

### Requirement: Local development without Docker
The default local development command SHALL start the SPA and Worker dev servers without needing Docker, with containers disabled. A separate command SHALL start them with containers enabled. When containers are disabled, container-backed endpoints SHALL respond with HTTP 503 instead of crashing.

#### Scenario: Default dev on a machine without Docker
- **WHEN** `pnpm run dev` is run with no Docker daemon available
- **THEN** both dev servers start, and `/api/health`, auth and chat work

#### Scenario: Sandbox call with containers disabled
- **WHEN** `/api/sandbox/exec` is called during `pnpm run dev`
- **THEN** the API responds with HTTP 503 and an explanatory error

#### Scenario: Dev with containers
- **WHEN** `pnpm run dev:containers` is run with Docker available
- **THEN** sandbox execution works locally

## MODIFIED Requirements

### Requirement: Worker-native unit testing
Unit tests for the Worker package (`apps/api`) SHALL run inside a local workerd/miniflare environment with real binding stubs (D1, KV, R2, Durable Objects, Workflows, rate limiters). They SHALL NOT connect to remote Cloudflare services. D1 migrations SHALL be applied before tests run. Authenticated tests SHALL obtain real sessions by signing up, not by mocking auth. Workflow tests SHALL mock individual step results rather than calling AI or containers.

#### Scenario: Worker test with bindings
- **WHEN** a test in `apps/api` accesses `env.DB`, `env.KV` or a Durable Object namespace
- **THEN** the test runs against local stubs, with the D1 schema migrated, and produces deterministic results

#### Scenario: Test run from root
- **WHEN** `pnpm test` is run from the monorepo root
- **THEN** each package's tests run through its own Vitest configuration (`pnpm -r run test`), and the Worker tests use the Cloudflare test pool

#### Scenario: Tests without credentials
- **WHEN** the test suite runs with no Cloudflare login or API token
- **THEN** all tests run and the suite exits successfully
