import { z } from "zod";
import { ConversationIdSchema } from "./chat.js";

export const SandboxExecRequestSchema = z.object({
  // JavaScript source, run with `node -e` in an isolated container
  code: z.string().min(1).max(20_000),
});

export const AgentTaskRequestSchema = z.object({
  prompt: z.string().min(1).max(4_000),
  conversationId: ConversationIdSchema.optional(),
});
