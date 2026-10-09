---
name: add-api-route
description: Add a new Hono API route to the Worker backend
---

## Add an API Route

1. If the route needs request validation, add Zod schemas to `packages/shared/src/schemas/`:
   - Define the schema with `z.object({...})`, with `.max()` limits on strings and arrays
   - Export the inferred type: `export type MyType = z.infer<typeof MySchema>`
   - Export from `packages/shared/src/schemas/index.ts`

2. Create the route file at `apps/api/src/routes/<name>.ts`. Chain the handlers (so their
   types reach `AppType` and the web client) and validate with `validate()`:
   ```typescript
   import { MySchema } from "@cf-ai-spa/shared";
   import { Hono } from "hono";
   import type { Env } from "../env.js";
   import { validate } from "../lib/validate.js";

   export const myRoutes = new Hono<Env>()
     .get("/endpoint", (c) => c.json({ data: "value" }))
     .post("/endpoint", validate("json", MySchema), (c) => {
       const input = c.req.valid("json");
       return c.json({ received: input }, 201);
     });
   ```
   - Pass explicit status codes to `c.json()` so the client can narrow on them
   - Don't catch errors just to return 500 — the global `onError` in `index.ts` does that

3. Mount it in `apps/api/src/index.ts`:
   - If it needs a session, add `app.use("/api/my/*", authMiddleware)` next to the others
   - Add `.route("/api/my", myRoutes)` to the `routes` chain (so `AppType` includes it)
   - If it checks credentials or sends email, add its path to the `AUTH_RATE_LIMITER` list;
     if it spends AI/compute, apply `rateLimit("AI_RATE_LIMITER", byUserId)` on that handler

4. If the route uses Cloudflare bindings not yet in `Env`, add them to `wrangler.jsonc`
   (top level, `env.staging` and `env.staging.previews`) AND `apps/api/src/env.ts` —
   typecheck fails at `BindingsMatchWrangler` if they drift

5. Call it from the SPA through the typed client: `api.my.endpoint.$get()` from
   `apps/web/src/lib/api.ts` (types come from `AppType`; use `InferResponseType` for types)

6. Write a test at `apps/api/src/__tests__/<name>.test.ts`:
   ```typescript
   import { SELF } from "cloudflare:test";
   import { describe, expect, it } from "vitest";
   ```
   If the route calls Workers AI, mock it instead — see `src/__tests__/setup/mock-ai.ts`

7. Run checks:
   ```bash
   pnpm run typecheck
   pnpm run lint
   pnpm --filter @cf-ai-spa/api run test
   ```
