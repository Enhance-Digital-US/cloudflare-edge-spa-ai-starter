import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { type ZodType, z } from "zod";

// zValidator with this API's 400 body: `{ error: { formErrors, fieldErrors } }`.
// Validated data is then typed on `c.req.valid(target)` and flows into the RPC client.
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) return c.json({ error: z.flattenError(result.error) }, 400);
  });
