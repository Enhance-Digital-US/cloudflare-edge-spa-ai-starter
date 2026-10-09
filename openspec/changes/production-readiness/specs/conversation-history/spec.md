# Spec Delta

## Purpose

Defines server-side storage of chat conversations per user, so conversation turns survive page reloads and can be read back or cleared through the API.

## ADDED Requirements

### Requirement: Per-user conversation storage
Conversations SHALL be stored per (authenticated user, conversation id) pair, with messages kept in insertion order and each having a role (`user` or `assistant`), content and creation time. The same conversation id used by two different users SHALL refer to two independent conversations.

#### Scenario: Ordered history
- **WHEN** messages "hi" (user), "hello" (assistant) and "again" (user) are appended to a conversation
- **THEN** listing the conversation returns them in that order

#### Scenario: Users cannot see each other's conversations
- **WHEN** user A has messages in conversation `c1` and user B requests conversation `c1`
- **THEN** user B receives an empty history

### Requirement: Read conversation history
`GET /api/conversations/:id/messages` SHALL return the authenticated user's messages for that conversation, up to the most recent 200. It SHALL require a session and SHALL reject invalid conversation ids with HTTP 400.

#### Scenario: Unauthenticated read
- **WHEN** the endpoint is called without a session
- **THEN** it responds with HTTP 401

#### Scenario: Invalid id
- **WHEN** the endpoint is called with id `bad:id`
- **THEN** it responds with HTTP 400

### Requirement: Clear a conversation
`DELETE /api/conversations/:id` SHALL remove all of the authenticated user's messages in that conversation and respond with HTTP 204. The conversation SHALL remain usable afterwards.

#### Scenario: Clear then reuse
- **WHEN** a conversation is cleared and a new message is then appended
- **THEN** listing returns only the new message
