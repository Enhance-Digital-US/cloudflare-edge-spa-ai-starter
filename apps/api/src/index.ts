import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./env.js";
import { createAuth } from "./lib/auth.js";
import { authMiddleware } from "./middleware/auth.js";
import { byClientIp, byUserId, rateLimit } from "./middleware/rate-limit.js";
import { aiRoutes } from "./routes/ai.js";
import { authConfigRoutes } from "./routes/auth-config.js";
import { conversationRoutes } from "./routes/conversations.js";
import { healthRoutes } from "./routes/health.js";
import { sandboxRoutes } from "./routes/sandbox.js";
import { taskRoutes } from "./routes/tasks.js";

export { CodeSandbox } from "./durable-objects/code-sandbox.js";
export { Conversation } from "./durable-objects/conversation.js";
export { AgentTaskWorkflow } from "./workflows/agent-task.js";

// Chat requests carry the client's whole history; the schemas cap individual fields.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const app = new Hono<Env>();

// Only /api/* reaches the Worker (run_worker_first); SPA responses get their
// headers from apps/web/public/_headers instead.
app.use(
  "/api/*",
  secureHeaders(),
  // Cookie-authenticated routes: reject cross-site form posts. JSON requests are
  // already protected, since cross-origin JSON needs a CORS preflight we never grant.
  csrf(),
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: "Request body too large" }, 413),
  }),
  async (c, next) => {
    c.set("auth", createAuth(c.env));
    await next();
  },
);

// Brute-force / abuse protection on endpoints that check credentials or send email.
// Better Auth's own limiter is disabled (see lib/auth.ts), so these are the only limits.
for (const path of [
  "/api/auth/sign-*",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/auth/send-verification-email",
]) {
  app.use(path, rateLimit("AUTH_RATE_LIMITER", byClientIp));
}

// `/x/*` also matches `/x` in Hono, so register each middleware once. The per-user
// AI limit on sandbox/tasks is applied inside the routes, only where compute is spent.
app.use("/api/ai/*", authMiddleware, rateLimit("AI_RATE_LIMITER", byUserId));
app.use("/api/conversations/*", authMiddleware);
app.use("/api/sandbox/*", authMiddleware);
app.use("/api/tasks/*", authMiddleware);

// Chained so `AppType` carries every route's input and output types for the RPC client.
const routes = app
  // Registered before the Better Auth catch-all so it isn't swallowed by it.
  .route("/api/auth", authConfigRoutes)
  .on(["GET", "POST"], "/api/auth/*", (c) => c.var.auth.handler(c.req.raw))
  .route("/api", healthRoutes)
  .route("/api/ai", aiRoutes)
  .route("/api/conversations", conversationRoutes)
  .route("/api/sandbox", sandboxRoutes)
  .route("/api/tasks", taskRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  // Thrown by middleware/validators (e.g. malformed JSON → 400, CSRF → 403).
  if (err instanceof HTTPException) {
    return c.json({ error: err.message || "Request failed" }, err.status);
  }
  console.error(JSON.stringify({ event: "unhandled_error", path: c.req.path, err: String(err) }));
  return c.json({ error: "Internal server error" }, 500);
});

export type AppType = typeof routes;
export default app;
