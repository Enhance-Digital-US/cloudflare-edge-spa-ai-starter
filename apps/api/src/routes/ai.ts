import { type ChatMessage, ChatRequestSchema, DEFAULT_MODEL } from "@cf-ai-spa/shared";
import { createWorkersAiChat } from "@cloudflare/tanstack-ai/adapters/workers-ai";
import { chat, type StreamChunk, toHttpResponse } from "@tanstack/ai";
import { Hono } from "hono";
import { conversationName } from "../durable-objects/conversation.js";
import type { Env } from "../env.js";
import { fitToBudget } from "../lib/chat-context.js";
import { validate } from "../lib/validate.js";

// Owned by the server: clients cannot send system messages (the schema rejects them).
export const CHAT_SYSTEM_PROMPT =
  "You are a helpful assistant for developers building on Cloudflare. " +
  "Answer concisely in Markdown, with fenced code blocks for code.";

export const aiRoutes = new Hono<Env>().post(
  "/chat",
  validate("json", ChatRequestSchema),
  async (c) => {
    const { messages, model, forwardedProps } = c.req.valid("json");
    const conversationId = forwardedProps?.conversationId;
    const { id: userId } = c.var.user;

    // Routed through this environment's AI Gateway. The user id goes in gateway
    // metadata so spend limits and log filters can be scoped per user. Chat
    // prompts are effectively never identical, so caching is skipped.
    const adapter = createWorkersAiChat(model ?? DEFAULT_MODEL, {
      binding: c.env.AI.gateway(c.env.AI_GATEWAY_ID),
      metadata: { userId, environment: c.env.ENVIRONMENT },
      skipCache: true,
      sessionAffinity: userId,
    });
    const run = (history: ChatMessage[]) =>
      chat({
        adapter,
        stream: true,
        systemPrompts: [CHAT_SYSTEM_PROMPT],
        messages: fitToBudget(history),
      });

    if (!conversationId) {
      return toHttpResponse(run(messages));
    }

    // With a persisted conversation the stored history is authoritative: only the
    // client's new turn (the schema guarantees the last message is the user's) is
    // used, so a client can't rewrite earlier turns. It is saved before streaming,
    // and the assistant reply once it has streamed.
    const conversation = c.env.CONVERSATION.getByName(conversationName(userId, conversationId));
    const userTurn = messages.slice(-1);
    const stored = await conversation.list();
    await conversation.append(userTurn);
    const history = [...stored.map(({ role, content }) => ({ role, content })), ...userTurn];
    return toHttpResponse(persistAssistantReply(run(history), conversation));
  },
);

// Passes chunks through unchanged while collecting the assistant's text, then
// saves it when the stream completes.
async function* persistAssistantReply(
  stream: AsyncIterable<StreamChunk>,
  conversation: { append(m: { role: "assistant"; content: string }[]): Promise<void> },
): AsyncIterable<StreamChunk> {
  let text = "";
  for await (const chunk of stream) {
    if (chunk.type === "TEXT_MESSAGE_CONTENT") text += chunk.delta;
    yield chunk;
  }
  if (text) await conversation.append([{ role: "assistant", content: text }]);
}
