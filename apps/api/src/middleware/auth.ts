import { createMiddleware } from "hono/factory";
import type { Env } from "../env.js";

// Requires a valid Better Auth session (cookie set by /api/auth/*).
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", { id: session.user.id, email: session.user.email });

  await next();
});
