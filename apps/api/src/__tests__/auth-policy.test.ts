import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../env.js";
import { createAuth, isEmailAllowed } from "../lib/auth.js";

const baseEnv = env as unknown as Env["Bindings"];

describe("GET /api/auth/providers", () => {
  it("reports only configured capabilities", async () => {
    const response = await SELF.fetch("http://localhost/api/auth/providers");
    expect(response.status).toBe(200);
    // No OAuth credentials or EMAIL_FROM in the test env
    expect(await response.json()).toEqual({
      socialProviders: [],
      emailVerification: false,
      passwordReset: false,
    });
  });
});

describe("isEmailAllowed", () => {
  const withDomains = (d: string) => ({ ...baseEnv, AUTH_ALLOWED_EMAIL_DOMAINS: d });

  it("allows everyone when no domains are configured", () => {
    expect(isEmailAllowed(withDomains(""), "anyone@anywhere.dev")).toBe(true);
  });

  it("matches configured domains case-insensitively, ignoring whitespace", () => {
    const e = withDomains(" Example.com , acme.io");
    expect(isEmailAllowed(e, "a@example.com")).toBe(true);
    expect(isEmailAllowed(e, "b@ACME.IO")).toBe(true);
    expect(isEmailAllowed(e, "c@evil.com")).toBe(false);
  });

  it("does not match subdomains or suffix tricks", () => {
    const e = withDomains("example.com");
    expect(isEmailAllowed(e, "a@sub.example.com")).toBe(false);
    expect(isEmailAllowed(e, "a@notexample.com")).toBe(false);
  });
});

describe("sign-up domain policy (database hook)", () => {
  const auth = createAuth({ ...baseEnv, AUTH_ALLOWED_EMAIL_DOMAINS: "allowed.com" });
  const signUp = (email: string) =>
    auth.api.signUpEmail({ body: { email, password: "correct-horse-battery", name: "T" } });

  it("rejects sign-up from a non-allowed domain", async () => {
    await expect(signUp(`x-${crypto.randomUUID()}@blocked.com`)).rejects.toThrow(/restricted/);
  });

  it("accepts sign-up from an allowed domain", async () => {
    const result = await signUp(`x-${crypto.randomUUID()}@allowed.com`);
    expect(result.user.email).toMatch(/@allowed\.com$/);
  });
});

describe("email verification (EMAIL_FROM set)", () => {
  const auth = createAuth({ ...baseEnv, EMAIL_FROM: "noreply@example.com" });

  it("does not issue a session until the email is verified", async () => {
    const email = `v-${crypto.randomUUID()}@example.com`;
    const result = await auth.api.signUpEmail({
      body: { email, password: "correct-horse-battery", name: "V" },
    });
    expect(result.token).toBeNull();

    await expect(
      auth.api.signInEmail({ body: { email, password: "correct-horse-battery" } }),
    ).rejects.toThrow(/verif/i);
  });
});

describe("preview hosts (BETTER_AUTH_ALLOWED_HOSTS)", () => {
  const auth = createAuth({
    ...baseEnv,
    BETTER_AUTH_URL: "https://cf-ai-spa-staging.acme.workers.dev",
    BETTER_AUTH_ALLOWED_HOSTS: "*-cf-ai-spa-staging.acme.workers.dev",
  });
  const signUpFrom = (origin: string) =>
    auth.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({
          email: `p-${crypto.randomUUID()}@example.com`,
          password: "correct-horse-battery",
          name: "P",
        }),
      }),
    );

  it("accepts sign-up from a preview hostname", async () => {
    const res = await signUpFrom("https://pr-42-cf-ai-spa-staging.acme.workers.dev");
    expect(res.status).toBe(200);
  });

  it("still rejects other origins (CSRF)", async () => {
    const res = await auth.handler(
      new Request("https://pr-42-cf-ai-spa-staging.acme.workers.dev/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify({
          email: "x@example.com",
          password: "correct-horse-battery",
          name: "X",
        }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
