import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { Env } from "../env.js";

type RateLimitBinding = "AUTH_RATE_LIMITER" | "AI_RATE_LIMITER";

// Returns the rate-limit key for a request, or null to skip limiting.
type KeyFn = (c: Context<Env>) => string | null;

// The client IP is always present behind Cloudflare's edge. It's absent only in
// local dev/tests without the header, where limiting is skipped.
export const byClientIp: KeyFn = (c) => c.req.header("cf-connecting-ip") ?? null;

export const byUserId: KeyFn = (c) => c.var.user?.id ?? null;

export function rateLimit(binding: RateLimitBinding, key: KeyFn) {
  return createMiddleware<Env>(async (c, next) => {
    const k = key(c);
    if (k) {
      const { success } = await c.env[binding].limit({ key: k });
      if (!success) {
        return c.json({ error: "Too many requests" }, 429, { "Retry-After": "60" });
      }
    }
    await next();
  });
}
