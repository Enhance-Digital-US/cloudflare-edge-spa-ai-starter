# Spec Delta

## Purpose

Defines request limits that protect credential endpoints from brute force and cap per-user consumption of inference and compute, including how limited requests are answered.

## ADDED Requirements

### Requirement: Credential endpoint limit
Sign-in, sign-up and password-reset requests SHALL be limited to 10 per 60 seconds per client IP. Requests over the limit SHALL receive HTTP 429 with a `Retry-After` header and SHALL NOT reach the auth handler. Limits for one IP SHALL NOT affect other IPs.

#### Scenario: Brute-force attempt
- **WHEN** a single IP sends 11 sign-in attempts within 60 seconds
- **THEN** the first 10 are processed and the 11th receives HTTP 429

#### Scenario: Other clients unaffected
- **WHEN** one IP is being rate limited
- **THEN** requests from a different IP are processed normally

### Requirement: Per-user AI and compute limit
Chat requests, sandbox executions and agent-task creations SHALL share a limit of 20 per 60 seconds per authenticated user. Each request SHALL count exactly once. Reading task status and conversation history SHALL NOT count toward the limit.

#### Scenario: Limit reached
- **WHEN** a user makes 21 chat requests within 60 seconds
- **THEN** the 21st receives HTTP 429

#### Scenario: Each request counted once
- **WHEN** a user creates 21 tasks within 60 seconds
- **THEN** the first 429 arrives on the 21st request, not earlier

#### Scenario: Status polling is free
- **WHEN** a rate-limited user polls a task's status
- **THEN** the status request is not rejected with HTTP 429

### Requirement: Isolated limiter namespaces per environment
Production, staging and previews SHALL use distinct rate-limiter namespaces, so traffic in one environment never consumes another's limits.

#### Scenario: Staging load
- **WHEN** staging traffic exhausts a user's limit on staging
- **THEN** that user's limit in production is unaffected
