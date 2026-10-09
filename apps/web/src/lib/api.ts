import type { AppType } from "@cf-ai-spa/api/app";
import { hc, type InferResponseType } from "hono/client";

// Typed client for the Worker's API: paths, request bodies and JSON responses are
// inferred from the Hono routes (via TypeScript project references to apps/api).
// Same-origin, so the Better Auth session cookie is sent automatically.
export const api = hc<AppType>("/").api;

export type AuthCapabilities = InferResponseType<typeof api.auth.providers.$get>;
export type SocialProvider = AuthCapabilities["socialProviders"][number];
