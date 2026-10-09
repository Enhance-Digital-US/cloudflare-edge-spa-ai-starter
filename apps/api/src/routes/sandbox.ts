import { SandboxExecRequestSchema } from "@cf-ai-spa/shared";
import { Hono } from "hono";
import type { Env } from "../env.js";
import { validate } from "../lib/validate.js";
import { byUserId, rateLimit } from "../middleware/rate-limit.js";

// Runs JavaScript in the caller's own isolated container (no Internet access).
export const sandboxRoutes = new Hono<Env>().post(
  "/exec",
  rateLimit("AI_RATE_LIMITER", byUserId),
  validate("json", SandboxExecRequestSchema),
  async (c) => {
    try {
      const result = await c.env.SANDBOX.getByName(c.var.user.id).run(c.req.valid("json").code);
      return c.json(result, 200);
    } catch (err) {
      // Local `pnpm run dev` disables containers (no Docker needed); use `pnpm run dev:containers`.
      if (String(err).includes("No container is configured")) {
        return c.json({ error: "Sandbox is not available in this environment" }, 503);
      }
      throw err;
    }
  },
);
