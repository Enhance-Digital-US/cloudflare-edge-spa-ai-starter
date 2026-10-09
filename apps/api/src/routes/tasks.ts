import { AgentTaskRequestSchema } from "@cf-ai-spa/shared";
import { Hono } from "hono";
import type { Env } from "../env.js";
import { validate } from "../lib/validate.js";
import { byUserId, rateLimit } from "../middleware/rate-limit.js";

// Instance ids are prefixed with the owner's user id, so ownership can be
// checked from the id alone without a separate lookup table.
const ownedBy = (userId: string, taskId: string) => taskId.startsWith(`${userId}-`);

export const taskRoutes = new Hono<Env>()
  // Only creating a task spends inference; polling its status is not rate limited.
  .post(
    "/",
    rateLimit("AI_RATE_LIMITER", byUserId),
    validate("json", AgentTaskRequestSchema),
    async (c) => {
      const userId = c.var.user.id;
      const instance = await c.env.AGENT_TASK.create({
        id: `${userId}-${crypto.randomUUID()}`,
        params: { userId, ...c.req.valid("json") },
      });
      return c.json({ id: instance.id }, 202);
    },
  )
  .get("/:id", async (c) => {
    const taskId = c.req.param("id");
    if (!ownedBy(c.var.user.id, taskId)) return c.json({ error: "Not found" }, 404);

    try {
      const status = await (await c.env.AGENT_TASK.get(taskId)).status();
      return c.json({
        id: taskId,
        status: status.status,
        output: status.output,
        error: status.error,
      });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  });
