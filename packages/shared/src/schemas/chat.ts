import { z } from "zod";

// Models clients may request. Anything else is rejected, so a caller can't
// opt into a more expensive model than the app intends to pay for.
export const ALLOWED_MODELS = ["@cf/moonshotai/kimi-k2.7-code"] as const;
export const DEFAULT_MODEL: (typeof ALLOWED_MODELS)[number] = "@cf/moonshotai/kimi-k2.7-code";

// Request-size caps. The AI rate limiter counts requests, not tokens, so these bound
// what a single request can cost. ~4 characters per token for English text.
// Longest message a user may send (≈8k tokens).
export const MAX_MESSAGE_CHARS = 32_000;
// Total characters of history sent to the model (≈30k tokens). Older turns beyond
// this are dropped server-side, so long conversations keep working as a sliding window.
// This, not the request size, is what bounds the cost of a turn.
export const MAX_CONTEXT_CHARS = 120_000;
// The client re-sends its whole history (including reasoning/tool messages) every turn,
// so this only bounds parsing work; it's generous so long sessions don't start failing.
export const MAX_WIRE_MESSAGES = 500;

// Client-chosen id; also used in Durable Object names, so keep it to a safe charset.
export const ConversationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
});

// TanStack AI's client sends AG-UI wire messages. Besides user/assistant turns it echoes
// back reasoning, tool and activity messages, which this app doesn't use: they are
// accepted and dropped. "system" is rejected — system prompts are owned by the server.
const WireMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: ChatMessageSchema.shape.content }),
  // Model replies can be longer than user messages, and can be empty (e.g. only
  // reasoning); empty ones are dropped below.
  z.object({
    role: z.literal("assistant"),
    content: z.string().max(MAX_CONTEXT_CHARS).nullish(),
  }),
  z.looseObject({ role: z.enum(["reasoning", "tool", "activity"]) }),
]);

export const ChatRequestSchema = z.object({
  messages: z
    .array(WireMessageSchema)
    .min(1)
    .max(MAX_WIRE_MESSAGES)
    .transform((messages) =>
      messages.flatMap((m): ChatMessage[] =>
        (m.role === "user" || m.role === "assistant") && m.content
          ? [{ role: m.role, content: m.content }]
          : [],
      ),
    )
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "The last message must be a user message",
    }),
  model: z.enum(ALLOWED_MODELS).optional(),
  // TanStack AI's useChat sends per-session options in AG-UI `forwardedProps`
  forwardedProps: z.object({ conversationId: ConversationIdSchema.optional() }).optional(),
});

export const ChatResponseSchema = z.object({
  message: ChatMessageSchema,
  finishReason: z.enum(["stop", "length", "tool_calls"]).optional(),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;
