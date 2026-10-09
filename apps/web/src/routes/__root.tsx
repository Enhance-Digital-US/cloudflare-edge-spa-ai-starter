import { Button, buttonVariants, TooltipProvider } from "@cf-ai-spa/ui";
import { createRootRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createRootRoute({
  component: RootLayout,
});

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle theme"
    >
      {dark ? (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </Button>
  );
}

function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  if (isPending) return null;

  if (!session) {
    return (
      <Link to="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">{session.user.email}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await authClient.signOut();
          navigate({ to: "/" });
        }}
      >
        Sign out
      </Button>
    </div>
  );
}

function RootLayout() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  AI
                </div>
                CF AI SPA
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  to="/"
                  activeProps={{
                    className: buttonVariants({ variant: "secondary", size: "sm" }),
                  }}
                  inactiveProps={{
                    className: buttonVariants({ variant: "ghost", size: "sm" }),
                  }}
                >
                  Home
                </Link>
                <Link
                  to="/chat"
                  activeProps={{
                    className: buttonVariants({ variant: "secondary", size: "sm" }),
                  }}
                  inactiveProps={{
                    className: buttonVariants({ variant: "ghost", size: "sm" }),
                  }}
                >
                  Chat
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <UserMenu />
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
