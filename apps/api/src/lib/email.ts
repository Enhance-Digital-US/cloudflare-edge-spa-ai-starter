import type { Env } from "../env.js";

type Bindings = Env["Bindings"];

// Email is "configured" when a sender address is set. The EMAIL binding is always
// declared in wrangler.jsonc, but the sender's domain must be onboarded to Email
// Service (`wrangler email sending enable <domain>`) before sends succeed.
export function isEmailConfigured(env: Bindings): boolean {
  return Boolean(env.EMAIL_FROM);
}

interface AuthEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendAuthEmail(env: Bindings, email: AuthEmail): Promise<void> {
  if (!env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not set — cannot send auth email");
  }
  try {
    await env.EMAIL.send({
      to: email.to,
      from: { email: env.EMAIL_FROM, name: "CF AI SPA" },
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch (err) {
    // Runs in waitUntil, so failures can't reach the client — log for observability.
    console.error(
      JSON.stringify({ event: "auth_email_failed", subject: email.subject, err: String(err) }),
    );
  }
}

export function linkEmail(action: string, url: string) {
  const safeUrl = url.replace(/"/g, "&quot;");
  return {
    text: `${action}: ${url}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>${action}:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  };
}
