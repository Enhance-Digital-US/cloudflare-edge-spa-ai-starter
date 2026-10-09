# Spec Delta

## Purpose

Defines the pnpm monorepo workspace layout, package boundaries, and cross-package dependency rules that enforce runtime safety across browser, Workers, and universal code.

## ADDED Requirements

### Requirement: Workspace package structure
The workspace SHALL contain five packages: `apps/web` (browser SPA), `apps/api` (Workers backend), `packages/ui` (shared UI components), `packages/shared` (cross-runtime types and schemas), and `packages/tsconfig` (shared TypeScript configurations).

#### Scenario: All packages are recognized by pnpm
- **WHEN** `pnpm install` is run from the monorepo root
- **THEN** all five packages are resolved and their dependencies installed without errors

#### Scenario: Packages can import from workspace siblings
- **WHEN** `apps/web` declares a dependency on `packages/ui` using the workspace protocol
- **THEN** imports from `@cf-ai-spa/ui` resolve correctly at build time

### Requirement: Runtime type isolation
The workspace SHALL provide TypeScript configurations that prevent cross-runtime API usage: browser-only APIs (DOM) MUST NOT be available in `apps/api` or `packages/shared`, and Workers-only APIs MUST NOT be available in `packages/shared`.

#### Scenario: DOM API used in Worker code
- **WHEN** `apps/api` source code references `document` or `window`
- **THEN** TypeScript reports a compilation error

#### Scenario: Workers API used in shared code
- **WHEN** `packages/shared` source code references a Workers-only type not in the shared config
- **THEN** TypeScript reports a compilation error

### Requirement: Root-level script orchestration
The monorepo root SHALL provide scripts to run dev servers, build all packages, lint, format, typecheck, test, and deploy from a single entry point.

#### Scenario: Full build from root
- **WHEN** `pnpm build` is run from the monorepo root
- **THEN** all packages build in dependency order and produce their outputs without errors

#### Scenario: Parallel typecheck
- **WHEN** `pnpm typecheck` is run from the monorepo root
- **THEN** TypeScript checks every package and reports errors from any package that fails
