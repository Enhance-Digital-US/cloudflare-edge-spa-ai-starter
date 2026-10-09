import { Hono } from "hono";
import type { Env } from "../env.js";
import { enabledSocialProviders } from "../lib/auth.js";
import { isEmailConfigured } from "../lib/email.js";

// Public, non-secret auth capabilities so the SPA only renders what works.
export const authConfigRoutes = new Hono<Env>().get("/providers", (c) => {
  return c.json({
    socialProviders: enabledSocialProviders(c.env),
    emailVerification: isEmailConfigured(c.env),
    passwordReset: isEmailConfigured(c.env),
  });
});
