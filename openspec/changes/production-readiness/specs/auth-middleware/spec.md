# Spec Delta

## ADDED Requirements

### Requirement: Session authentication on protected routes
Protected API routes SHALL require a valid first-party session, established by signing in through the Worker's own auth endpoints under `/api/auth/*` and carried in an `HttpOnly` session cookie on the application's origin. Requests without a valid session SHALL be rejected with HTTP 401 and a JSON body `{ "error": "Unauthorized" }`. Sessions SHALL be persisted in the application database so they survive Worker restarts and can be revoked.

#### Scenario: Request with a valid session
- **WHEN** a signed-in user calls a protected route with their session cookie
- **THEN** the request proceeds to the route handler

#### Scenario: Request without a session
- **WHEN** a protected route is called with no session cookie
- **THEN** the Worker responds with HTTP 401 and `{ "error": "Unauthorized" }`

#### Scenario: Forged session cookie
- **WHEN** a protected route is called with a session cookie whose token was not issued by the server
- **THEN** the Worker responds with HTTP 401

#### Scenario: Session revoked by sign-out
- **WHEN** a user signs out and then calls a protected route with the same cookie jar
- **THEN** the Worker responds with HTTP 401

#### Scenario: Legacy Access header is ignored
- **WHEN** a protected route is called with only a `CF-Access-JWT-Assertion` header
- **THEN** the Worker responds with HTTP 401

### Requirement: Sign-in methods
The system SHALL support sign-up and sign-in with email and password. It SHALL also support GitHub and Google sign-in, each enabled only when both its client ID and client secret are configured for the environment. Using a provider that isn't configured SHALL return an error, not start an OAuth flow.

#### Scenario: Email and password sign-up
- **WHEN** a visitor submits a new email, a password of at least 8 characters, and a name to the sign-up endpoint
- **THEN** an account is created and, unless email verification is required, a session cookie is returned

#### Scenario: Unconfigured social provider
- **WHEN** a social sign-in is requested for a provider whose credentials are not configured
- **THEN** the endpoint returns an error identifying the provider as unavailable

### Requirement: Sign-up domain policy
The system SHALL support an optional, configurable list of allowed email domains. When the list is non-empty, account creation SHALL be rejected with HTTP 403 for any email whose domain is not on the list. This applies to email and password sign-up and to social sign-up alike. Domain matching SHALL be exact and case-insensitive, and subdomains SHALL NOT match their parent domain. When the list is empty, sign-up SHALL be open.

#### Scenario: Sign-up from an allowed domain
- **WHEN** the allowlist is `example.com,acme.io` and a visitor signs up as `user@ACME.IO`
- **THEN** the account is created

#### Scenario: Sign-up from a disallowed domain
- **WHEN** the allowlist is `allowed.com` and a visitor signs up as `user@blocked.com`
- **THEN** account creation is rejected and no user is stored

#### Scenario: Subdomain does not match
- **WHEN** the allowlist is `example.com` and a visitor signs up as `user@sub.example.com`
- **THEN** account creation is rejected

#### Scenario: Open sign-up
- **WHEN** the allowlist is empty
- **THEN** any email domain can create an account

### Requirement: Email verification
When a sender address is configured for the environment, the system SHALL require email verification for email and password accounts. On sign-up it SHALL send a verification link, and it SHALL issue no session until the address is verified. When no sender is configured, verification SHALL be disabled. Sending email SHALL NOT delay the HTTP response, so response timing does not reveal whether an account exists.

#### Scenario: Sign-up with verification enabled
- **WHEN** a sender is configured and a visitor signs up with email and password
- **THEN** the response contains no session token and a verification email is sent

#### Scenario: Sign-in before verifying
- **WHEN** a user with an unverified email tries to sign in with their password
- **THEN** sign-in is refused with an error indicating the email must be verified

#### Scenario: Verification disabled without a sender
- **WHEN** no sender is configured and a visitor signs up
- **THEN** the user receives a session immediately

### Requirement: Password reset
When a sender address is configured, the system SHALL let users ask for a password reset link by email and set a new password with the token from that link. The reset request SHALL get the same response whether or not the account exists. An invalid or expired token SHALL be reported to the client.

#### Scenario: Reset request for any email
- **WHEN** a reset is requested for an email address
- **THEN** the endpoint responds successfully without disclosing whether an account exists

#### Scenario: Reset with a valid token
- **WHEN** a user submits a new password with a valid reset token
- **THEN** the password is updated and the user can sign in with it

### Requirement: Auth capability discovery
The API SHALL expose an unauthenticated endpoint, `GET /api/auth/providers`, that returns which social providers are enabled and whether email verification and password reset are available. It SHALL reveal no secrets.

#### Scenario: No optional features configured
- **WHEN** no OAuth credentials and no sender address are configured
- **THEN** the endpoint returns `{ "socialProviders": [], "emailVerification": false, "passwordReset": false }`

### Requirement: Cross-origin request protection
State-changing auth requests SHALL be accepted only from the environment's trusted origin. For preview deployments, which each get their own hostname, the trusted origin set SHALL be extended by a configurable list of hostname patterns. Requests from any other origin SHALL be rejected with HTTP 403.

#### Scenario: Cross-origin sign-in attempt
- **WHEN** a sign-in request is sent with an `Origin` that is not the environment's trusted origin
- **THEN** the Worker responds with HTTP 403

#### Scenario: Sign-up from a preview hostname
- **WHEN** the allowed preview hosts include `*-cf-ai-spa-staging.<subdomain>.workers.dev` and a sign-up request comes from `https://pr-42-cf-ai-spa-staging.<subdomain>.workers.dev`
- **THEN** the request is accepted

## MODIFIED Requirements

### Requirement: User identity on context
The auth middleware SHALL resolve the authenticated user from the session and make the user's id and email available to downstream route handlers through a consistent context interface. Route handlers SHALL use this identity, never client-supplied values, to scope user data.

#### Scenario: Accessing user identity in a handler
- **WHEN** a route handler retrieves the user identity from the request context
- **THEN** it receives the authenticated user's id and email from the server-side session

### Requirement: Provider-agnostic middleware interface
The auth middleware SHALL expose a consistent interface whatever the underlying identity method. Adding, removing or reconfiguring sign-in methods (email and password, social providers) SHALL require no changes to route handlers.

#### Scenario: Swapping auth provider
- **WHEN** a social provider is enabled or disabled through configuration
- **THEN** route handlers continue to access user identity through the same context interface without modification

## REMOVED Requirements

### Requirement: Cloudflare Access JWT validation
**Reason**: The application needs public social sign-up, which Cloudflare Access (workforce identity, billed per seat) doesn't support well. The previous implementation also never verified JWT signatures, so the header could be forged on `workers.dev`.
**Migration**: Clients sign in through `/api/auth/*` and send the resulting session cookie. Remove any `CF-Access-JWT-Assertion` handling and the `BYPASS_AUTH` dev flag. Local development and tests sign up with email and password.
