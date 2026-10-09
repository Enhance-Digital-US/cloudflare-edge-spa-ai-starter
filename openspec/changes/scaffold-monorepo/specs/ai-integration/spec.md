# Spec Delta

## Purpose

Defines the AI integration layer using TanStack AI with the Cloudflare adapter, providing streaming chat, AI Gateway routing, and React hooks for consuming AI responses.

## ADDED Requirements

### Requirement: Streaming chat API endpoint
The API SHALL expose a chat endpoint that accepts a message history and streams the AI model's response token-by-token using server-sent events or a streaming protocol.

#### Scenario: Successful streaming chat
- **WHEN** a POST request with a valid message array is sent to the chat endpoint
- **THEN** the response streams back token-by-token as the model generates output

#### Scenario: Empty message array
- **WHEN** a POST request with an empty message array is sent to the chat endpoint
- **THEN** the API responds with HTTP 400 and an error describing the validation failure

### Requirement: AI Gateway routing
AI requests SHALL be routed through Cloudflare AI Gateway, enabling caching, rate limiting, logging, and analytics for all inference traffic.

#### Scenario: Cached response
- **WHEN** an identical chat request is made within the cache TTL window
- **THEN** the AI Gateway returns the cached response without invoking the model

#### Scenario: Gateway analytics
- **WHEN** AI requests are made through the gateway
- **THEN** request count, latency, and token usage are visible in the AI Gateway dashboard

### Requirement: React chat hooks
The SPA SHALL provide React hooks (via `@tanstack/ai-react`) for managing chat state, streaming responses, and rendering AI-generated content.

#### Scenario: useChat hook streams response
- **WHEN** a user sends a message via the chat UI
- **THEN** the `useChat` hook streams the response into the component's state and the UI updates incrementally

### Requirement: Multiple provider support
The AI integration SHALL support both Workers AI models (via `env.AI` binding) and third-party providers (OpenAI, Anthropic, Gemini) routed through AI Gateway, configurable per request.

#### Scenario: Workers AI model request
- **WHEN** a chat request specifies a Workers AI model (e.g., `@cf/meta/llama-4-scout-17b-16e-instruct`)
- **THEN** the request is handled via the `env.AI` binding without requiring an external API key

#### Scenario: Third-party model via Gateway
- **WHEN** a chat request specifies a third-party model routed through AI Gateway
- **THEN** the request is proxied through AI Gateway to the external provider with caching and rate limiting applied
