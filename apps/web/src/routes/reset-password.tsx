import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@cf-ai-spa/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";

// Better Auth redirects here from the emailed link with ?token=… (or ?error=INVALID_TOKEN).
type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    ...(typeof search.token === "string" && { token: search.token }),
    ...(typeof search.error === "string" && { error: search.error }),
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch();
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "done">("idle");
  const [error, setError] = useState<string | null>(
    linkError ? "This reset link is invalid or has expired. Request a new one." : null,
  );

  const requestLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setStatus("pending");
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message ?? "Something went wrong");
      setStatus("idle");
      return;
    }
    setStatus("sent");
  };

  const setNewPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const newPassword = String(new FormData(e.currentTarget).get("password"));
    setStatus("pending");
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) {
      setError(error.message ?? "Something went wrong");
      setStatus("idle");
      return;
    }
    setStatus("done");
  };

  const errorMessage = error && (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );

  return (
    <div className="mx-auto max-w-sm pt-8">
      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            {status === "sent"
              ? "If an account exists for that email, a reset link is on its way."
              : status === "done"
                ? "Your password has been updated."
                : token
                  ? "Choose a new password."
                  : "Enter your email and we'll send you a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "done" ? (
            <Button asChild className="w-full">
              <Link to="/sign-in">Sign in</Link>
            </Button>
          ) : status === "sent" ? null : token && !linkError ? (
            <form onSubmit={setNewPassword} className="space-y-3">
              <Input
                name="password"
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              {errorMessage}
              <Button type="submit" className="w-full" disabled={status === "pending"}>
                Update password
              </Button>
            </form>
          ) : (
            <form onSubmit={requestLink} className="space-y-3">
              <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
              {errorMessage}
              <Button type="submit" className="w-full" disabled={status === "pending"}>
                Send reset link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
