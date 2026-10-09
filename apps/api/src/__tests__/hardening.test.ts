import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("API hardening", () => {
  it("sets security headers on API responses", async () => {
    const response = await SELF.fetch("http://localhost/api/health");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=");
    await response.body?.cancel();
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const response = await SELF.fetch("http://localhost/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  // bodyLimit and csrf run before authentication, so these need no session.
  it("rejects oversized request bodies with 413", async () => {
    const response = await SELF.fetch("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(4 * 1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
    await response.body?.cancel();
  });

  it("rejects cross-site form posts (CSRF)", async () => {
    const response = await SELF.fetch("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
      },
      body: "prompt=hi",
    });
    expect(response.status).toBe(403);
    await response.body?.cancel();
  });
});
