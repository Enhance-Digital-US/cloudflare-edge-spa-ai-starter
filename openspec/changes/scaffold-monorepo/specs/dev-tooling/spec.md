# Spec Delta

## Purpose

Defines the development tooling stack: linting, formatting, testing, type checking, and git hooks that enforce code quality across the monorepo.

## ADDED Requirements

### Requirement: Unified lint and format
All TypeScript, TSX, and JSON source files across the monorepo SHALL be checked by a single linter and formatter (Biome) with a shared root configuration.

#### Scenario: Lint check from root
- **WHEN** `pnpm lint` is run from the monorepo root
- **THEN** Biome checks all source files and reports violations from any package

#### Scenario: Format check
- **WHEN** `pnpm lint` is run on a file with formatting issues
- **THEN** the violation is reported and `pnpm lint:fix` corrects it

### Requirement: Worker-native unit testing
Unit tests for the Worker package (`apps/api`) SHALL run inside a miniflare environment via `@cloudflare/vitest-pool-workers`, providing access to real binding stubs (AI, KV, D1, R2) without mocking.

#### Scenario: Worker test with bindings
- **WHEN** a test in `apps/api` accesses `env.KV` or `env.DB`
- **THEN** the test runs against local miniflare stubs and produces deterministic results

#### Scenario: Test run from root
- **WHEN** `pnpm test` is run from the monorepo root
- **THEN** Vitest runs tests from all packages using the workspace configuration

### Requirement: Pre-commit hook
A git pre-commit hook SHALL run Biome lint checks on staged files before allowing a commit.

#### Scenario: Commit with lint errors
- **WHEN** a developer attempts to commit files with lint violations
- **THEN** the pre-commit hook rejects the commit and reports the violations

#### Scenario: Commit with clean files
- **WHEN** a developer commits files that pass lint checks
- **THEN** the commit proceeds without interruption

### Requirement: Strict TypeScript across all packages
All packages SHALL use TypeScript in strict mode with consistent compiler options inherited from the shared `packages/tsconfig` configurations.

#### Scenario: Strict null check
- **WHEN** code in any package accesses a potentially null value without a null check
- **THEN** TypeScript reports a compilation error
