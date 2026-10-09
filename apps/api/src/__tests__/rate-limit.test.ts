import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signUpAndGetCookie } from "./setup/session.js";

describe("AUTH_RATE_LIMITER (10/60s per IP)", () => {
  it("returns 429 after the limit for one IP, without affecting another IP", async () => {
    const attempt = (ip: string) =>
      SELF.fetch("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          "cf-connecting-ip": ip,
        },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
      });

    const ip = `198.51.100.${Math.floor(Math.random() * 250)}`;
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await attempt(ip)).status);

    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses[10]).toBe(429);
    expect((await attempt("203.0.113.7")).status).not.toBe(429);
  });

  it("also limits password reset and email verification", async () => {
    const ip = `192.0.2.${Math.floor(Math.random() * 250)}`;
    const post = (path: string) =>
      SELF.fetch(`http://localhost/api/auth/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          "cf-connecting-ip": ip,
        },
        // The limiter runs before Better Auth, so an invalid body (cheap 400) is enough.
        body: "{}",
      });

    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await post("reset-password")).status);
    expect(statuses).not.toContain(429);
    // Same IP, same limiter: the 11th request is limited on a different credential path.
    expect((await post("send-verification-email")).status).toBe(429);
  });
});

describe("AI_RATE_LIMITER (20/60s per user)", () => {
  it("returns 429 after the per-user limit", async () => {
    const cookie = await signUpAndGetCookie();
    const chat = () =>
      SELF.fetch("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        // Invalid body → 400 from the route, so no real inference runs
        body: JSON.stringify({ messages: [] }),
      });

    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await chat()).status);

    expect(statuses.slice(0, 20).every((s) => s === 400)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe("AI_RATE_LIMITER on agent endpoints", () => {
  it("counts each task creation once, and never limits status polling", async () => {
    const cookie = await signUpAndGetCookie();
    const headers = { "Content-Type": "application/json", Cookie: cookie };

    // Invalid bodies → 400 after the limiter, so no workflow actually starts
    const creates: number[] = [];
    for (let i = 0; i < 21; i++) {
      creates.push(
        (await SELF.fetch("http://localhost/api/tasks", { method: "POST", headers, body: "{}" }))
          .status,
      );
    }
    expect(creates.indexOf(429)).toBe(20); // 21st request, not the 11th

    // Polling still works for a rate-limited user (404 = not theirs / not found, not 429)
    const poll = await SELF.fetch("http://localhost/api/tasks/someone-else", { headers });
    expect(poll.status).toBe(404);
  });
});
