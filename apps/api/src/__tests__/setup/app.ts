import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import app from "../../index.js";

// Calls the Worker's Hono app in the test's own module graph. Unlike SELF, module
// mocks apply here (e.g. the AI mock in mock-ai.ts), so use it for routes that run inference.
export async function appFetch(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.request(`http://localhost${path}`, init, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
