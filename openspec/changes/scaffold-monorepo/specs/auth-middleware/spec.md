# Spec Delta

## Purpose

Defines the authentication middleware for the Hono Worker, defaulting to Cloudflare Access JWT validation with a provider-agnostic interface to support future auth providers.

## ADDED Requirements

### Requirement: Cloudflare Access JWT validation
Protected API routes SHALL validate the `CF-Access-JWT-Assertion` header by verifying the JWT signature against Cloudflare Access's public keys. Requests without a valid JWT SHALL be rejected with HTTP 401.

#### Scenario: Valid Access JWT
- **WHEN** a request to a protected route includes a valid `CF-Access-JWT-Assertion` header
- **THEN** the request proceeds to the route handler

#### Scenario: Missing Access JWT
- **WHEN** a request to a protected route has no `CF-Access-JWT-Assertion` header
- **THEN** the Worker responds with HTTP 401 Unauthorized

#### Scenario: Invalid or expired JWT
- **WHEN** a request includes an expired or tampered `CF-Access-JWT-Assertion` header
- **THEN** the Worker responds with HTTP 401 Unauthorized

### Requirement: User identity on context
The auth middleware SHALL extract user identity (email, user ID) from the validated JWT and make it available to downstream route handlers via a consistent context interface.

#### Scenario: Accessing user identity in a handler
- **WHEN** a route handler retrieves the user identity from the request context
- **THEN** it receives the authenticated user's email and identity claims

### Requirement: Provider-agnostic middleware interface
The auth middleware SHALL expose a consistent interface regardless of the underlying auth provider. Swapping from Cloudflare Access to another provider (e.g., better-auth) SHALL require changing only the middleware implementation, not the route handlers.

#### Scenario: Swapping auth provider
- **WHEN** the auth middleware implementation is replaced with a different provider
- **THEN** route handlers continue to access user identity via the same context interface without modification
