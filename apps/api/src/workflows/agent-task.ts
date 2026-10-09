import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { DEFAULT_MODEL } from "@cf-ai-spa/shared";
import { createWorkersAiChat } from "@cloudflare/tanstack-ai/adapters/workers-ai";
import { chat } from "@tanstack/ai";
import type { SandboxResult } from "../durable-objects/code-sandbox.js";
import { conversationName } from "../durable-objects/conversation.js";
import type { Env } from "../env.js";

export interface AgentTaskParams {
  userId: string;
  prompt: string;
  conversationId?: string | undefined;
}

export interface AgentTaskOutput {
  code: string;
  result: SandboxResult;
}

const SYSTEM_PROMPT =
  "You write a single self-contained Node.js 24 script that solves the user's task and prints " +
  "the answer with console.log. No network access and no npm packages are available. " +
  "Reply with only one ```js code block.";

export function extractCode(text: string): string {
  const match = text.match(/```(?:js|javascript|node|ts|typescript)?\s*\n([\s\S]*?)```/);
  return (match?.[1] ?? text).trim();
}

// Durable multi-step agent task: generate code → run it in the user's sandbox →
// optionally record the result in a conversation. Each step is retried
// independently and its result is persisted, so a crash resumes mid-task.
export class AgentTaskWorkflow extends WorkflowEntrypoint<Env["Bindings"], AgentTaskParams> {
  async run(event: WorkflowEvent<AgentTaskParams>, step: WorkflowStep): Promise<AgentTaskOutput> {
    const { userId, prompt, conversationId } = event.payload;

    const code = await step.do(
      "generate code",
      { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" }, timeout: "2 minutes" },
      async () => {
        const adapter = createWorkersAiChat(DEFAULT_MODEL, {
          binding: this.env.AI.gateway(this.env.AI_GATEWAY_ID),
          metadata: { userId, environment: this.env.ENVIRONMENT, source: "agent-task" },
          skipCache: true,
        });
        const text = await chat({
          adapter,
          stream: false,
          systemPrompts: [SYSTEM_PROMPT],
          messages: [{ role: "user", content: prompt }],
        });
        return extractCode(text);
      },
    );

    // Not retried: model-generated code may have side effects inside the sandbox.
    const result = await step.do(
      "run in sandbox",
      { timeout: "1 minute" },
      async (): Promise<SandboxResult> => {
        // Copy into a plain object: step results must be serializable, not RPC wrappers.
        const r = await this.env.SANDBOX.getByName(userId).run(code);
        return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, timedOut: r.timedOut };
      },
    );

    if (conversationId) {
      await step.do("save to conversation", async () => {
        const output = result.timedOut ? result.stderr : result.stdout || result.stderr;
        await this.env.CONVERSATION.getByName(conversationName(userId, conversationId)).append([
          { role: "user", content: `[task] ${prompt}` },
          {
            role: "assistant",
            content: `\`\`\`js\n${code}\n\`\`\`\n\nOutput:\n\`\`\`\n${output}\n\`\`\``,
          },
        ]);
      });
    }

    return { code, result };
  }
}
