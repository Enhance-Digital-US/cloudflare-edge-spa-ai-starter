import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const response = await SELF.fetch("http://localhost/api/health");
    expect(response.status).toBe(200);
    const body = await response.json<{ status: string; timestamp: string }>();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});
