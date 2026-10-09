import type { ChatMessage } from "@cf-ai-spa/shared";

// Never call real Workers AI in tests. In a test file (see ai.test.ts):
//   vi.mock("@tanstack/ai", (orig) => import("./setup/mock-ai.js").then((m) => m.mockTanstackAi(orig)));
//   vi.resetModules();
//   const { appFetch } = await import("./setup/app.js");
//   const { chatCalls } = await import("./setup/mock-ai.js");
// `chat()` then streams MOCK_REPLY and records its input in `chatCalls`. The reset is
// needed because the pool loads the Worker's modules before the test's mocks exist.
// Requests through SELF are never mocked: SELF runs the pool's own copy of the Worker.
export const chatCalls: { systemPrompts?: string[]; messages: ChatMessage[] }[] = [];
export const MOCK_REPLY = "Hi there";

export async function mockTanstackAi(importOriginal: <T>() => Promise<T>) {
  const actual = await importOriginal<typeof import("@tanstack/ai")>();
  return {
    ...actual,
    chat: (options: (typeof chatCalls)[number]) => {
      chatCalls.push(options);
      return (async function* () {
        yield { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: MOCK_REPLY, timestamp: 0 };
      })();
    },
  };
}
