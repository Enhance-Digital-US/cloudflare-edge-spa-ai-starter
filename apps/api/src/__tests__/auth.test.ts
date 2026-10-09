import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signUpAndGetCookie } from "./setup/session.js";

const chatBody = JSON.stringify({ messages: [{ role: "user", content: "Hello" }] });

describe("Auth", () => {
  it("allows /api/health without auth", async () => {
    const response = await SELF.fetch("http://localhost/api/health");
    expect(response.status).toBe(200);
  });

  it("returns 401 for /api/ai/chat without a session", async () => {
    const response = await SELF.fetch("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: chatBody,
    });
    expect(response.status).toBe(401);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 for a forged session cookie", async () => {
    const response = await SELF.fetch("http://localhost/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "better-auth.session_token=forged.token",
      },
      body: chatBody,
    });
    expect(response.status).toBe(401);
  });

  it("ignores the legacy Cloudflare Access header", async () => {
    const response = await SELF.fetch("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Access-JWT-Assertion": "a.b.c" },
      body: chatBody,
    });
    expect(response.status).toBe(401);
  });

  it("returns the session for a signed-up user", async () => {
    const cookie = await signUpAndGetCookie();
    const response = await SELF.fetch("http://localhost/api/auth/get-session", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    const body = await response.json<{ user: { email: string } } | null>();
    expect(body?.user.email).toMatch(/@example\.com$/);
  });

  it("allows /api/ai/chat with a valid session", async () => {
    const cookie = await signUpAndGetCookie();
    const response = await SELF.fetch("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      // Invalid body: a 400 from the route's validator proves auth passed, without inference.
      body: JSON.stringify({ messages: [] }),
    });
    expect(response.status).toBe(400);
  });
});
