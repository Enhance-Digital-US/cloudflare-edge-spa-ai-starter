import { ConversationIdSchema } from "@cf-ai-spa/shared";
import { Hono } from "hono";
import { z } from "zod";
import { conversationName } from "../durable-objects/conversation.js";
import type { Env } from "../env.js";
import { validate } from "../lib/validate.js";

const ParamsSchema = z.object({ id: ConversationIdSchema });

export const conversationRoutes = new Hono<Env>()
  .get("/:id/messages", validate("param", ParamsSchema), async (c) => {
    const { id } = c.req.valid("param");
    const stub = c.env.CONVERSATION.getByName(conversationName(c.var.user.id, id));
    return c.json({ messages: await stub.list() });
  })
  .delete("/:id", validate("param", ParamsSchema), async (c) => {
    const { id } = c.req.valid("param");
    await c.env.CONVERSATION.getByName(conversationName(c.var.user.id, id)).clear();
    return c.body(null, 204);
  });
