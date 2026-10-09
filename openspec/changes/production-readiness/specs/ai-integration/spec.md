# Spec Delta

## ADDED Requirements

### Requirement: Model allowlist
The chat API SHALL accept only models on a server-defined allowlist. A request naming any other model SHALL be rejected with HTTP 400 before inference runs. A request that names no model SHALL use the default model.

#### Scenario: Allowlisted model
- **WHEN** a chat request names a model on the allowlist
- **THEN** the request is processed with that model

#### Scenario: Model outside the allowlist
- **WHEN** a chat request names a model that is not on the allowlist
- **THEN** the API responds with HTTP 400 and no inference runs

#### Scenario: No model specified
- **WHEN** a chat request omits the model
- **THEN** the default model is used

### Requirement: Authenticated chat
The chat endpoint SHALL require an authenticated session and SHALL be subject to the per-user AI rate limit.

#### Scenario: Unauthenticated chat request
- **WHEN** a chat request is sent without a session
- **THEN** the API responds with HTTP 401 and no inference runs

### Requirement: Chat turn persistence
When a chat request includes a conversation id, the API SHALL save the request's final user message before streaming starts. It SHALL save the assistant's complete reply text after the stream finishes, in the authenticated user's copy of that conversation. Chat requests without a conversation id SHALL be processed without persistence. Conversation ids SHALL be 1–64 characters from `[A-Za-z0-9_-]`, and others SHALL be rejected with HTTP 400.

#### Scenario: Chat with a conversation id
- **WHEN** a signed-in user sends a chat message with conversation id `c1` and the reply finishes streaming
- **THEN** that user's history for `c1` contains the user message followed by the assistant's full reply

#### Scenario: Unsafe conversation id
- **WHEN** a chat request carries a conversation id containing `:` or `/`
- **THEN** the API responds with HTTP 400

## MODIFIED Requirements

### Requirement: AI Gateway routing
AI requests SHALL be routed through the AI Gateway configured for the current environment. Production, staging and local development SHALL each use a distinct gateway. Every request SHALL carry the authenticated user's id and the environment name as gateway metadata, so gateway spend limits, analytics and logs can be scoped per user. Response caching SHALL be bypassed for chat requests.

#### Scenario: Per-user attribution
- **WHEN** a signed-in user sends a chat request
- **THEN** the gateway receives the request tagged with that user's id and the environment name

#### Scenario: No cached chat responses
- **WHEN** two identical chat requests are made in quick succession
- **THEN** both are sent to the model rather than served from the gateway cache

#### Scenario: Gateway missing in an environment
- **WHEN** the configured gateway does not exist in the account
- **THEN** the chat stream reports an error event instead of model output

#### Scenario: Gateway analytics
- **WHEN** AI requests are made through the gateway
- **THEN** request count, latency, token usage and spend are visible in that environment's AI Gateway dashboard

## REMOVED Requirements

### Requirement: Multiple provider support
**Reason**: Letting clients pick any model or provider is a cost and abuse risk. The application now serves an allowlisted set of Workers AI models.
**Migration**: To offer another model, add it to the server-side model allowlist. Third-party providers can be added later behind the same allowlist.
