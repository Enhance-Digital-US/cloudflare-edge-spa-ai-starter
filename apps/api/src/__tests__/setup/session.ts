import { SELF } from "cloudflare:test";

// Signs up a fresh user via Better Auth and returns the session cookie header.
export async function signUpAndGetCookie(): Promise<string> {
  const email = `user-${crypto.randomUUID()}@example.com`;
  const response = await SELF.fetch("http://localhost/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ email, password: "correct-horse-battery", name: "Test User" }),
  });
  if (!response.ok) {
    throw new Error(`sign-up failed: ${response.status} ${await response.text()}`);
  }
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("sign-up returned no session cookie");
  return cookie;
}
