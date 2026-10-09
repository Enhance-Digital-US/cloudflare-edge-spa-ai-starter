# Spec Delta

## Purpose

Defines durable, multi-step agent tasks that turn a natural-language prompt into code, execute it in the user's sandbox, and optionally record the result in a conversation, with progress that survives failures and restarts.

## ADDED Requirements

### Requirement: Create an agent task
`POST /api/tasks` with `{ prompt, conversationId? }` SHALL start a durable task for the authenticated user and respond with HTTP 202 and the task `id`. The prompt SHALL be 1–4,000 characters. The endpoint SHALL require a session and SHALL be subject to the per-user AI and compute limit.

#### Scenario: Task accepted
- **WHEN** a signed-in user posts `{ "prompt": "print the sum of 1 and 2" }`
- **THEN** the API responds with HTTP 202 and a task id

#### Scenario: Invalid task
- **WHEN** the prompt is missing or empty
- **THEN** the API responds with HTTP 400 and no task is started

### Requirement: Task steps and durability
A task SHALL run three steps in order:
1. Generate a Node.js script from the prompt with the default model.
2. Execute the script in the task owner's sandbox.
3. If a conversation id was given, append the prompt and a reply containing the code and its output to that conversation.

Each completed step's result SHALL be persisted so that a restart resumes after the last completed step. Code generation SHALL be retried on failure. Execution SHALL NOT be retried automatically, because generated code may have side effects.

#### Scenario: Successful task with a conversation
- **WHEN** a task with conversation id `t1` completes
- **THEN** its output contains the generated code and execution result, and conversation `t1` has the prompt and an assistant message containing the code and output

#### Scenario: Execution failure
- **WHEN** the sandbox step fails
- **THEN** the task ends in the `errored` state with the error message, and the step is not retried

### Requirement: Owner-scoped task status
`GET /api/tasks/:id` SHALL return the task's `status` (for example `running`, `complete` or `errored`), its `output` and its `error`, but only to the user who created it. Tasks belonging to other users and unknown ids SHALL both return HTTP 404, so task ids reveal nothing about other users.

#### Scenario: Owner polls status
- **WHEN** the task's creator requests its status after completion
- **THEN** the response has `status: "complete"` and the task output

#### Scenario: Another user's task
- **WHEN** a user requests the status of a task created by someone else
- **THEN** the API responds with HTTP 404
