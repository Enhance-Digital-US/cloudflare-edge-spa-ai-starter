# Spec Delta

## Purpose

Defines the production, staging, and preview environments the application runs in, how their data and configuration are isolated, and the rules that keep their configurations complete and consistent.

## ADDED Requirements

### Requirement: Separate production and staging Workers
The application SHALL deploy production and staging as separate Workers (`cf-ai-spa` and `cf-ai-spa-staging`). Each SHALL have its own D1 database, KV namespace, R2 bucket, Durable Object storage, Workflow, container application, rate-limiter namespaces, AI Gateway and secrets. Account-global names, such as Workflow names and container application names, SHALL differ between environments.

#### Scenario: Staging data is isolated
- **WHEN** a user signs up on staging
- **THEN** no user record is created in the production database

#### Scenario: Explicit production target
- **WHEN** the production deploy command runs
- **THEN** it targets the top-level (production) configuration explicitly, and wrangler issues no ambiguous-environment warning

### Requirement: Complete per-environment configuration
Every binding and variable the Worker reads SHALL be declared for each environment it is deployed to: production, staging, and staging previews. Previews SHALL NOT rely on inheriting configuration from staging. A dry-run deploy of each environment SHALL list the same set of binding names.

#### Scenario: New binding added
- **WHEN** a developer adds a binding at the top level only
- **THEN** the staging dry-run's binding list differs from production's, which reveals the omission

### Requirement: Previews use staging resources
PR previews SHALL be created from the staging Worker only. Their D1, KV, R2, AI Gateway and email bindings SHALL point at staging resources, never production. Each preview SHALL get its own Durable Object storage. Previews SHALL run the existing staging Workflow rather than a per-preview Workflow.

#### Scenario: Preview cannot reach production data
- **WHEN** a preview handles a request
- **THEN** every storage binding it uses resolves to a staging or preview-only resource

#### Scenario: Workflow change in a preview
- **WHEN** a pull request changes the agent-task workflow
- **THEN** the preview still runs staging's workflow code, and the change is first exercised for real after deploying to staging

### Requirement: Environment identification
Each deployment SHALL expose its environment name to application code. Local development SHALL identify as `development`, even though the top-level configuration is production.

#### Scenario: Local dev identity
- **WHEN** the Worker runs under `wrangler dev` with the documented `.dev.vars`
- **THEN** the environment name is `development` and the local AI Gateway is used
