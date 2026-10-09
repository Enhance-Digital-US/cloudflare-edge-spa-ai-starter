---
name: add-binding
description: Add a new Cloudflare binding (D1, KV, R2, Durable Object, etc.) to the Worker
---

## Add a Cloudflare Binding

1. **Create the resource** (if it doesn't exist):
   ```bash
   # D1
   pnpm exec wrangler d1 create <database-name>
   # KV
   pnpm exec wrangler kv namespace create <BINDING_NAME>
   # R2
   pnpm exec wrangler r2 bucket create <bucket-name>
   ```

2. **Add to `wrangler.jsonc`** with the returned ID:
   ```jsonc
   // Example for D1
   "d1_databases": [
     { "binding": "DB", "database_name": "my-db", "database_id": "<id-from-step-1>" }
   ]
   ```

3. **Add the TypeScript type to `apps/api/src/env.ts`**:
   ```typescript
   export interface Env {
     Bindings: {
       // ... existing bindings
       NEW_BINDING: D1Database; // or KVNamespace, R2Bucket, DurableObjectNamespace, etc.
     };
   }
   ```

4. **Update tests** if they need the binding — the `@cloudflare/vitest-plugin` auto-stubs most bindings via the wrangler config

5. Run checks:
   ```bash
   pnpm run typecheck
   pnpm --filter @cf-ai-spa/api run test
   ```
