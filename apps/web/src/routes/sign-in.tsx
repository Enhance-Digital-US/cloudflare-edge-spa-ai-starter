import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Separator,
} from "@cf-ai-spa/ui";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, fetchAuthCapabilities, type SocialProvider } from "../lib/auth-client";

type SignInSearch = { redirect?: string };

export const Route = createFileRoute("/sign-in")({
  // Only allow same-origin relative redirects to avoid an open redirect.
  validateSearch: (search: Record<string, unknown>): SignInSearch => {
    const redirect = search.redirect;
    return typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")
      ? { redirect }
      : {};
  },
  loader: fetchAuthCapabilities,
  component: SignInPage,
});

const providerLabels: Record<SocialProvider, string> = {
  github: "Continue with GitHub",
  google: "Continue with Google",
};

function SignInPage() {
  const { redirect = "/chat" } = Route.useSearch();
  const capabilities = Route.useLoaderData();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmailFor, setCheckEmailFor] = useState<string | null>(null);

  const handleSocial = async (provider: SocialProvider) => {
    setError(null);
    const { error } = await authClient.signIn.social({ provider, callbackURL: redirect });
    if (error) setError(error.message ?? `${provider} sign-in is not available`);
  };

  const handleEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    setPending(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
        : await authClient.signIn.email({ email, password });
    setPending(false);

    if (error) {
      setError(error.message ?? "Something went wrong");
      return;
    }
    // With verification on, sign-up succeeds without a session until the link is clicked.
    if (mode === "sign-up" && capabilities.emailVerification) {
      setCheckEmailFor(email);
      return;
    }
    navigate({ to: redirect });
  };

  if (checkEmailFor) {
    return (
      <div className="mx-auto max-w-sm pt-8">
        <Card>
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to {checkEmailFor}. Open it to finish signing up.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm pt-8">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "sign-in" ? "Sign in" : "Create an account"}</CardTitle>
          <CardDescription>Sign in to start chatting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {capabilities.socialProviders.length > 0 && (
            <>
              <div className="space-y-2">
                {capabilities.socialProviders.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSocial(id)}
                  >
                    {providerLabels[id]}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1" />
                or
                <Separator className="flex-1" />
              </div>
            </>
          )}

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "sign-up" && (
              <Input name="name" placeholder="Name" autoComplete="name" required />
            )}
            <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
            <Input
              name="password"
              type="password"
              placeholder="Password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {mode === "sign-in" ? "Sign in" : "Sign up"}
            </Button>
          </form>

          {mode === "sign-in" && capabilities.passwordReset && (
            <p className="text-center text-sm">
              <Link
                to="/reset-password"
                className="text-muted-foreground underline underline-offset-4"
              >
                Forgot password?
              </Link>
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {mode === "sign-in" ? "No account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-foreground underline underline-offset-4"
              onClick={() => {
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                setError(null);
              }}
            >
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
