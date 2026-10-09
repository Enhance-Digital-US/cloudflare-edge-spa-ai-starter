import { introspectWorkflow, SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../env.js";
import { extractCode } from "../workflows/agent-task.js";
import { signUpAndGetCookie } from "./setup/session.js";

const bindings = env as unknown as Env["Bindings"];

describe("extractCode", () => {
  it("pulls the first fenced code block", () => {
    expect(extractCode("Here:\n```js\nconsole.log(1)\n```\nDone")).toBe("console.log(1)");
    expect(extractCode("```\nconsole.log(2)\n```")).toBe("console.log(2)");
  });

  it("falls back to the raw text when there is no fence", () => {
    expect(extractCode("  console.log(3)  ")).toBe("console.log(3)");
  });
});

describe("/api/sandbox/exec", () => {
  it("requires a session", async () => {
    const res = await SELF.fetch("http://localhost/api/sandbox/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "console.log(1)" }),
    });
    expect(res.status).toBe(401);
  });

  it("validates the request body", async () => {
    const cookie = await signUpAndGetCookie();
    const res = await SELF.fetch("http://localhost/api/sandbox/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ code: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("/api/tasks (AgentTaskWorkflow)", () => {
  it("requires a session", async () => {
    const res = await SELF.fetch("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "add 1 and 2" }),
    });
    expect(res.status).toBe(401);
  });

  it("hides tasks that belong to another user", async () => {
    const cookie = await signUpAndGetCookie();
    const res = await SELF.fetch("http://localhost/api/tasks/someone-else-123", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("runs generate → sandbox → save, and reports status to its owner", async () => {
    await using introspector = await introspectWorkflow(bindings.AGENT_TASK);
    await introspector.modifyAll(async (m) => {
      await m.mockStepResult({ name: "generate code" }, "console.log(1 + 2)");
      await m.mockStepResult(
        { name: "run in sandbox" },
        { stdout: "3\n", stderr: "", exitCode: 0, timedOut: false },
      );
    });

    const cookie = await signUpAndGetCookie();
    const conversationId = `t-${crypto.randomUUID()}`;
    const created = await SELF.fetch("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ prompt: "add 1 and 2", conversationId }),
    });
    expect(created.status).toBe(202);
    const { id } = await created.json<{ id: string }>();

    const [instance] = await introspector.get();
    if (!instance) throw new Error("workflow instance was not created");
    await instance.waitForStatus("complete");

    const status = await (
      await SELF.fetch(`http://localhost/api/tasks/${id}`, { headers: { Cookie: cookie } })
    ).json<{ status: string; output: { result: { stdout: string } } }>();
    expect(status.status).toBe("complete");
    expect(status.output.result.stdout).toBe("3\n");

    const history = await (
      await SELF.fetch(`http://localhost/api/conversations/${conversationId}/messages`, {
        headers: { Cookie: cookie },
      })
    ).json<{ messages: { role: string; content: string }[] }>();
    expect(history.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(history.messages[1]?.content).toContain("console.log(1 + 2)");
  });
});
