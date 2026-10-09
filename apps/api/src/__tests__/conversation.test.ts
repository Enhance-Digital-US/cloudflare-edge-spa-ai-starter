import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../env.js";
import { signUpAndGetCookie } from "./setup/session.js";

vi.mock("@tanstack/ai", (orig) => import("./setup/mock-ai.js").then((m) => m.mockTanstackAi(orig)));
// The pool loads the Worker's modules before this file's mocks exist; re-import them.
vi.resetModules();
const { appFetch } = await import("./setup/app.js");

const bindings = env as unknown as Env["Bindings"];

describe("Conversation Durable Object", () => {
  it("appends and lists messages in order, and clears", async () => {
    const stub = bindings.CONVERSATION.getByName(`test:${crypto.randomUUID()}`);
    await stub.append([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    await stub.append([{ role: "user", content: "again" }]);

    const messages = await stub.list();
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "hi"],
      ["assistant", "hello"],
      ["user", "again"],
    ]);

    await stub.clear();
    expect(await stub.list()).toEqual([]);
  });
});

describe("/api/conversations", () => {
  const get = (id: string, cookie?: string) =>
    appFetch(`/api/conversations/${id}/messages`, {
      headers: cookie ? { Cookie: cookie } : {},
    });

  it("requires a session", async () => {
    expect((await get("abc")).status).toBe(401);
  });

  it("rejects unsafe conversation ids", async () => {
    const cookie = await signUpAndGetCookie();
    expect((await get("bad:id", cookie)).status).toBe(400);
  });

  it("persists the user's chat turn and isolates conversations per user", async () => {
    const alice = await signUpAndGetCookie();
    const bob = await signUpAndGetCookie();
    const conversationId = `c-${crypto.randomUUID()}`;

    const chat = await appFetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice },
      body: JSON.stringify({
        messages: [{ role: "user", content: "remember me" }],
        forwardedProps: { conversationId },
      }),
    });
    await chat.body?.cancel();

    const aliceView = await (await get(conversationId, alice)).json<{
      messages: { role: string; content: string }[];
    }>();
    expect(aliceView.messages[0]).toMatchObject({ role: "user", content: "remember me" });

    // Same conversation id, different user → a different Durable Object
    const bobView = await (await get(conversationId, bob)).json<{ messages: unknown[] }>();
    expect(bobView.messages).toEqual([]);
  });
});
