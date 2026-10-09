import { createAuthClient } from "better-auth/react";
import { type AuthCapabilities, api } from "./api";

export type { SocialProvider } from "./api";

// Same-origin: the Worker serves both the SPA and /api/auth/*, so no baseURL is
// needed and the session cookie is first-party.
export const authClient = createAuthClient({ basePath: "/api/auth" });

// What the server has configured, so the UI only offers working options.
export async function fetchAuthCapabilities(): Promise<AuthCapabilities> {
  const response = await api.auth.providers.$get();
  if (!response.ok) {
    return { socialProviders: [], emailVerification: false, passwordReset: false };
  }
  return response.json();
}
