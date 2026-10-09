# Spec Delta

## Purpose

Defines how request logs, distributed traces, and grouped failures are collected for each deployed environment so production issues can be diagnosed from data that was already being recorded.

## ADDED Requirements

### Requirement: Logs, traces and failure grouping
Every deployed environment SHALL persist Worker logs for all requests, record traces, and group failures as Issues. Production SHALL sample traces at 10% to control cost. Staging SHALL record traces for all requests.

#### Scenario: Production request
- **WHEN** a request is served by production
- **THEN** its logs are persisted, and roughly one in ten requests also produces a trace

#### Scenario: Staging request
- **WHEN** a request is served by staging
- **THEN** its logs and a trace are persisted

#### Scenario: Recurring failure
- **WHEN** the same uncaught error happens repeatedly in production
- **THEN** it appears as a single grouped Issue

### Requirement: Structured logging of background failures
Failures in work that finishes after the response has been sent, such as sending auth emails, SHALL be logged as structured JSON with an event name, because the client can't observe them.

#### Scenario: Email send fails
- **WHEN** sending a verification email fails
- **THEN** a JSON log line with `event: "auth_email_failed"` and the error is written
