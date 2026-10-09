# Spec Delta

## Purpose

Defines the Hono-based Cloudflare Worker that serves API routes and the SPA's static assets as a single deployment unit.

## ADDED Requirements

### Requirement: API route serving
The Worker SHALL serve API routes under the `/api` path prefix using Hono's router.

#### Scenario: API request routed to handler
- **WHEN** a request is made to `/api/health`
- **THEN** the Worker responds with a JSON health check response and HTTP 200

#### Scenario: Unknown API route
- **WHEN** a request is made to `/api/nonexistent`
- **THEN** the Worker responds with HTTP 404

### Requirement: SPA static asset serving
The Worker SHALL serve the built SPA's static assets via Cloudflare's `assets` binding. Non-API requests that do not match a static file SHALL fall back to `index.html`.

#### Scenario: Static asset request
- **WHEN** a request is made for a static file (e.g., `/assets/index-abc123.js`)
- **THEN** the Worker serves the file from the assets binding

#### Scenario: SPA fallback for unmatched paths
- **WHEN** a request is made to a non-API path with no matching static file (e.g., `/chat`)
- **THEN** the Worker serves `index.html` for client-side routing

### Requirement: Typed Cloudflare bindings
The Worker SHALL define a typed `Env` interface that includes bindings for AI (Workers AI + AI Gateway), D1, KV, and R2. All route handlers SHALL access bindings through this typed interface.

#### Scenario: Binding type safety
- **WHEN** a route handler accesses `env.AI`, `env.DB`, `env.KV`, or `env.BUCKET`
- **THEN** TypeScript provides correct type information for each binding's API

#### Scenario: Missing binding access
- **WHEN** a route handler references a binding name not declared in the `Env` interface
- **THEN** TypeScript reports a compilation error

### Requirement: Workers runtime compatibility
The Worker SHALL run on the Cloudflare Workers runtime with a compatibility date of `2026-09-27` or later, which includes default `nodejs_compat` support.

#### Scenario: Deployment to Workers
- **WHEN** the Worker is deployed via `wrangler deploy`
- **THEN** the Worker starts and serves requests without runtime errors
