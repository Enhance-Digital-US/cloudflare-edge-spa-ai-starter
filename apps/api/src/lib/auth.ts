import { waitUntil } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import type { Env } from "../env.js";
import { isEmailConfigured, linkEmail, sendAuthEmail } from "./email.js";

type Bindings = Env["Bindings"];

export type SocialProviderId = "github" | "google";

// Only enable a social provider when both its credentials are configured, so
// local dev and tests work with email/password alone.
function socialProviders(env: Bindings) {
  return {
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  };
}

export function enabledSocialProviders(env: Bindings): SocialProviderId[] {
  return Object.keys(socialProviders(env)) as SocialProviderId[];
}

// AUTH_ALLOWED_EMAIL_DOMAINS: comma-separated list (e.g. "example.com,acme.io").
// Empty/unset = open sign-up. Applies to email/password AND social sign-ups,
// because both create users through the same database hook.
export function isEmailAllowed(env: Bindings, email: string): boolean {
  const domains = (env.AUTH_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return true;
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  return domains.includes(domain);
}

// PR previews each get their own hostname, so a fixed BETTER_AUTH_URL would fail
// Better Auth's origin (CSRF) check there. BETTER_AUTH_ALLOWED_HOSTS (comma-separated,
// wildcards allowed) switches to a per-request base URL restricted to those hosts;
// they are also trusted as origins. Unknown hosts fall back to BETTER_AUTH_URL.
function baseURL(env: Bindings) {
  const allowedHosts = (env.BETTER_AUTH_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (allowedHosts.length === 0) return env.BETTER_AUTH_URL;
  return { allowedHosts, protocol: "auto" as const, fallback: env.BETTER_AUTH_URL };
}

// Bindings are per-request on Workers, so the auth instance is created per
// request (cached on the Hono context by the middleware) rather than at module scope.
export function createAuth(env: Bindings) {
  const emailEnabled = isEmailConfigured(env);

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: baseURL(env),
    basePath: "/api/auth",
    emailAndPassword: {
      enabled: true,
      // Verification is only enforceable when we can actually send email.
      requireEmailVerification: emailEnabled,
      ...(emailEnabled && {
        // Not awaited (waitUntil) so response timing doesn't reveal whether the account exists.
        sendResetPassword: async ({ user, url }) => {
          waitUntil(
            sendAuthEmail(env, {
              to: user.email,
              subject: "Reset your password",
              ...linkEmail("Reset your password", url),
            }),
          );
        },
      }),
    },
    ...(emailEnabled && {
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          waitUntil(
            sendAuthEmail(env, {
              to: user.email,
              subject: "Verify your email",
              ...linkEmail("Verify your email address", url),
            }),
          );
        },
      },
    }),
    socialProviders: socialProviders(env),
    // Better Auth's limiter defaults to in-memory storage, which on Workers is per
    // isolate and so ineffective. Credential and email endpoints are limited by the
    // AUTH_RATE_LIMITER binding instead (see index.ts).
    rateLimit: { enabled: false },
    advanced: {
      // Behind Cloudflare this is the real client IP; X-Forwarded-For is client-controlled.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isEmailAllowed(env, user.email)) {
              throw new APIError("FORBIDDEN", {
                message: "Sign-up is restricted for this email domain",
              });
            }
            return { data: user };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
