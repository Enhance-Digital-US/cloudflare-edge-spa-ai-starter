# Spec Delta

## Purpose

Defines isolated execution of untrusted JavaScript, including model-generated code, on behalf of an authenticated user, with strict limits on network access, time, and output size.

## ADDED Requirements

### Requirement: Isolated per-user execution
`POST /api/sandbox/exec` with body `{ code }` SHALL run the code as a Node.js script in a Linux environment dedicated to the authenticated user, and return `stdout`, `stderr`, `exitCode` and `timedOut`. One user's code SHALL never run in another user's environment. The endpoint SHALL require a session and SHALL be subject to the per-user AI and compute limit.

#### Scenario: Successful execution
- **WHEN** a signed-in user submits `console.log(1 + 2)`
- **THEN** the response contains `stdout: "3\n"`, `exitCode: 0` and `timedOut: false`

#### Scenario: Unauthenticated execution
- **WHEN** the endpoint is called without a session
- **THEN** it responds with HTTP 401 and no code runs

### Requirement: Execution limits
Submitted code SHALL be 1–20,000 characters, and other sizes SHALL be rejected with HTTP 400. Each execution SHALL be stopped after 10 seconds and reported with `timedOut: true`. `stdout` and `stderr` SHALL each be truncated to 64 KB, with a truncation marker added.

#### Scenario: Infinite loop
- **WHEN** a user submits `while (true) {}`
- **THEN** the response arrives after about 10 seconds with `timedOut: true`

#### Scenario: Oversized code
- **WHEN** a user submits code longer than 20,000 characters
- **THEN** the API responds with HTTP 400

### Requirement: No network access
Code running in the sandbox SHALL have no outbound Internet access.

#### Scenario: Outbound request attempt
- **WHEN** submitted code tries to fetch an external URL
- **THEN** the request fails, and the failure appears in `stderr` or a non-zero `exitCode`

### Requirement: Idle shutdown
A user's sandbox environment SHALL stop automatically after 5 minutes without activity, and SHALL start again on the next execution request.

#### Scenario: Return after idle
- **WHEN** a user runs code, waits more than 5 minutes, and runs code again
- **THEN** the second execution succeeds in a freshly started environment

### Requirement: Unavailable sandbox
When the sandbox runtime isn't available in the current environment (for example, local development without containers), the endpoint SHALL respond with HTTP 503 and an explanatory error.

#### Scenario: Containers disabled
- **WHEN** `/api/sandbox/exec` is called in an environment without container support
- **THEN** the API responds with HTTP 503 and `{ "error": "Sandbox is not available in this environment" }`
