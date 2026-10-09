import type { z } from "zod";
import type { ChatMessageSchema, ChatRequestSchema, ChatResponseSchema } from "../schemas/chat.js";
import type { UserSchema } from "../schemas/user.js";

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type User = z.infer<typeof UserSchema>;
