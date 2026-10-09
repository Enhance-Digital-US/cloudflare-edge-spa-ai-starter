import type { CodeSandbox } from "./durable-objects/code-sandbox.js";
import type { Conversation } from "./durable-objects/conversation.js";
import type { Auth } from "./lib/auth.js";
import type { AgentTaskParams } from "./workflows/agent-task.js";

export interface Env {
  Bindings: {
    AI: Ai;
    ASSETS: Fetcher;
    DB: D1Database;
    KV: KVNamespace;
    BUCKET: R2Bucket;
    CONVERSATION: DurableObjectNamespace<Conversation>;
    SANDBOX: DurableObjectNamespace<CodeSandbox>;
    AGENT_TASK: Workflow<AgentTaskParams>;
    AUTH_RATE_LIMITER: RateLimit;
    AI_RATE_LIMITER: RateLimit;
    EMAIL: SendEmail;
    ENVIRONMENT: "development" | "staging" | "production";
    AI_GATEWAY_ID: string;
    // Comma-separated email domains allowed to sign up; empty = open sign-up
    AUTH_ALLOWED_EMAIL_DOMAINS?: string;
    // Sender for verification/reset emails; its domain must be onboarded to Email Service.
    // Unset = email verification and password reset are disabled.
    EMAIL_FROM?: string;
    // Secrets — set with `wrangler secret put <NAME> [--env staging]`, or in .dev.vars locally
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    // Previews only: comma-separated hostnames (wildcards OK) for a per-request base URL
    BETTER_AUTH_ALLOWED_HOSTS?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  };
  Variables: {
    auth: Auth;
    user: { email: string; id: string };
  };
}

// Drift check against `wrangler types` (apps/api/worker-configuration.d.ts, generated from
// wrangler.jsonc by `pnpm run cf-typegen`): every binding and var declared in wrangler.jsonc
// must be declared above with a compatible type, or this line fails to typecheck. The
// hand-written interface stays the source of truth because it is more precise (unions,
// optional vars and secrets, preview-only vars).
type Assert<T extends true> = T;
export type BindingsMatchWrangler = Assert<
  Required<Env["Bindings"]> extends Cloudflare.Env ? true : false
>;
