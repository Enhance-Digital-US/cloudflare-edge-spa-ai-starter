# Tasks

## 1. Monorepo Foundation

- [x] 1.1 Initialize pnpm workspace: create root `package.json` (name: `cf-ai-spa`, private: true), `pnpm-workspace.yaml` listing `apps/*` and `packages/*`, and `.gitignore`. Verify `pnpm install` succeeds with an empty workspace.
- [x] 1.2 Create `packages/tsconfig` package with `package.json` (name: `@cf-ai-spa/tsconfig`), `tsconfig.base.json` (strict, ES2022, bundler resolution, verbatimModuleSyntax), `tsconfig.web.json` (extends base, adds DOM + react-jsx), `tsconfig.worker.json` (extends base, adds @cloudflare/workers-types, no DOM), and `tsconfig.shared.json` (extends base, no DOM, no Workers types). Verify each config file is valid JSON and extends correctly by running `tsc --showConfig` against a minimal consuming tsconfig.
- [x] 1.3 Create root `.editorconfig` and `.npmrc` (shamefully-hoist=false, strict-peer-dependencies=true). Verify pnpm respects the config on next install.

## 2. Shared Package

- [x] 2.1 Create `packages/shared` with `package.json` (name: `@cf-ai-spa/shared`), `tsconfig.json` extending `@cf-ai-spa/tsconfig/shared`, and `src/index.ts` barrel export. Add `zod` as a dependency. Verify `pnpm typecheck` passes in this package.
- [x] 2.2 Add Zod schemas in `src/schemas/chat.ts` (ChatMessage with role/content, ChatRequest with messages array, ChatResponse) and `src/schemas/user.ts` (User with email and id). Export inferred types from `src/types/index.ts`. Verify schemas validate sample data correctly with a unit test in `src/__tests__/schemas.test.ts`.

## 3. UI Package

- [x] 3.1 Create `packages/ui` with `package.json` (name: `@cf-ai-spa/ui`), `tsconfig.json` extending `@cf-ai-spa/tsconfig/web`. Add Tailwind CSS v4, `tailwind-merge`, `clsx`, and `class-variance-authority` as dependencies. Create `src/lib/utils.ts` with the `cn()` helper. Verify the package builds without errors.
- [x] 3.2 Add initial shadcn/ui components: Button, Card, and Input in `src/components/`. Configure `components.json` for the shadcn CLI to target `packages/ui/src/components/`. Create a barrel export at `src/index.ts`. Verify components export correctly by importing in a test file.

## 4. API Worker

- [x] 4.1 Create `apps/api` with `package.json`, `tsconfig.json` extending `@cf-ai-spa/tsconfig/worker`. Add `hono` and `@cloudflare/workers-types` as dependencies. Add `@cf-ai-spa/shared` as a workspace dependency. Verify TypeScript compilation succeeds.
- [x] 4.2 Create `src/env.ts` with the typed `Env` interface declaring all Cloudflare bindings: `AI` (Ai), `DB` (D1Database), `KV` (KVNamespace), `BUCKET` (R2Bucket). Create `src/index.ts` with a Hono app typed with `Env`, a `/api/health` route returning JSON, and a catch-all that passes through to static assets. Verify `pnpm typecheck` passes.
- [x] 4.3 Create root `wrangler.jsonc` with `name`, `compatibility_date: "2026-09-27"`, `main: "apps/api/src/index.ts"`, `assets.directory: "apps/web/dist"`, `assets.not_found_handling: "single-page-application"`, and placeholder bindings for AI, D1, KV, R2. Verify `wrangler deploy --dry-run` parses the config without errors.
- [x] 4.4 Add `apps/api/vitest.config.ts` using `@cloudflare/vitest-pool-workers`. Write a test in `src/__tests__/health.test.ts` that sends a request to `/api/health` and asserts a 200 response with the expected JSON. Verify the test passes with `vitest run`.

## 5. SPA Frontend

- [x] 5.1 Create `apps/web` with `package.json`, `tsconfig.json` extending `@cf-ai-spa/tsconfig/web`. Add `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/router-plugin`, `vite`, `@vitejs/plugin-react`, and `tailwindcss` (v4). Add `@cf-ai-spa/ui` and `@cf-ai-spa/shared` as workspace dependencies. Verify `pnpm install` resolves all packages.
- [x] 5.2 Create `vite.config.ts` with React and TanStack Router plugins. Configure a proxy for `/api` to `http://localhost:8787` (wrangler dev port). Create `index.html` as the SPA entry. Verify `vite build` produces output in `dist/`.
- [x] 5.3 Create `src/main.tsx` (React root with RouterProvider), `src/router.tsx` (router instance), and file-based routes: `src/routes/__root.tsx` (root layout importing UI components), `src/routes/index.tsx` (home page), `src/routes/chat.tsx` (placeholder chat page). Verify `routeTree.gen.ts` is auto-generated and `vite dev` serves the SPA with working navigation.
- [x] 5.4 Configure Tailwind CSS v4 in `apps/web` to include styles from `packages/ui`. Verify shadcn Button component renders with correct styles when imported from `@cf-ai-spa/ui` in a route.

## 6. AI Integration

- [x] 6.1 Add `@tanstack/ai`, `@cloudflare/tanstack-ai` to `apps/api`. Create `src/routes/ai.ts` with a POST `/api/ai/chat` route that validates the request body against the ChatRequest schema from `@cf-ai-spa/shared`, creates a `createWorkersAiChat` adapter with `env.AI`, and streams the response. Verify `pnpm typecheck` passes.
- [x] 6.2 Add AI Gateway configuration to the chat route: pass `gateway: { id: "default", skipCache: false, cacheTtl: 3600 }` as the third argument to `env.AI.run()`. Verify the gateway config is included in the adapter setup.
- [x] 6.3 Add `@tanstack/ai-react` to `apps/web`. Update `src/routes/chat.tsx` to use the `useChat` hook pointed at `/api/ai/chat`, with a message input, send button, and streaming message display using UI components from `@cf-ai-spa/ui`. Verify the chat page renders and the hook initializes without errors.
- [x] 6.4 Write a test in `apps/api/src/__tests__/ai.test.ts` that sends a POST to `/api/ai/chat` with a valid ChatRequest and asserts the response streams back. Verify the test passes with the miniflare AI binding stub.

## 7. Auth Middleware

- [x] 7.1 Create `apps/api/src/middleware/auth.ts` exporting a Hono middleware that reads the `CF-Access-JWT-Assertion` header, validates the JWT structure, extracts `email` from claims, and sets `c.set("user", { email, id })` on the context. Define the `Variables` type for Hono's context. Verify `pnpm typecheck` passes.
- [x] 7.2 Apply the auth middleware to a protected route group (e.g., `/api/ai/*`). Ensure `/api/health` remains unprotected. Verify a request to `/api/ai/chat` without a JWT header returns 401, and a request to `/api/health` returns 200 without auth.
- [x] 7.3 Write a test in `apps/api/src/__tests__/auth.test.ts` that verifies: (a) request with valid mock JWT proceeds, (b) request without JWT returns 401, (c) request with expired/invalid JWT returns 401. Verify all three test cases pass.

## 8. Dev Tooling

- [x] 8.1 Create root `biome.json` with recommended rules, React support, formatter settings (indent: 2 spaces, line width: 100), and file ignore patterns (node_modules, dist, .gen.ts files). Verify `pnpm lint` runs across all packages and reports no errors on existing code.
- [x] 8.2 Create root `vitest.workspace.ts` defining two project groups: `apps/api` (pool: `@cloudflare/vitest-pool-workers`) and a default group covering `apps/web`, `packages/shared`, and `packages/ui` (pool: default). Verify `pnpm test` from root discovers and runs tests from all packages.
- [x] 8.3 Install `lefthook` and create `lefthook.yml` with a pre-commit hook that runs `biome check --staged --no-errors-on-unmatched`. Verify `lefthook install` succeeds and the hook runs on a test commit.
- [x] 8.4 Add root `package.json` scripts: `dev` (concurrently runs web dev + wrangler dev), `build` (pnpm --filter web build), `lint` (biome check .), `lint:fix` (biome check --write .), `format` (biome format --write .), `typecheck` (pnpm -r --parallel run typecheck), `test` (vitest run), `deploy` (pnpm build && wrangler deploy), `preview` (pnpm build && wrangler dev). Add `concurrently` as a root dev dependency. Verify each script is callable without errors.

## 9. CI/CD Pipeline

- [x] 9.1 Create `.github/workflows/ci.yml`: triggers on pull_request, runs pnpm install, lint, typecheck, and test steps. Uses `pnpm/action-setup` and Node.js setup actions. Verify the workflow YAML is valid syntax (e.g., `yq` or manual review).
- [x] 9.2 Create `.github/workflows/deploy.yml`: triggers on push to main, runs pnpm install, lint, typecheck, test, build, then `wrangler deploy` using `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. Verify the workflow YAML is valid syntax.

## 10. Integration Verification

- [x] 10.1 Run `pnpm install` from root and verify all workspace dependencies resolve. Run `pnpm typecheck` and verify zero errors across all packages. Run `pnpm lint` and verify zero violations.
- [x] 10.2 Run `pnpm test` from root and verify all unit tests pass across apps/api, packages/shared, and any other test files.
- [x] 10.3 Run `pnpm dev` from root and verify both the Vite dev server (port 5173) and wrangler dev (port 8787) start. Navigate to `http://localhost:5173` and verify the SPA renders. Navigate to `/chat` and verify client-side routing works. Call `/api/health` via the proxy and verify a JSON response.
- [x] 10.4 Run `pnpm build` and `wrangler deploy --dry-run` to verify the production build completes and the deployment config is valid.
