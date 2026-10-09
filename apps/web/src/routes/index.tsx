import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@cf-ai-spa/ui";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const features = [
  {
    title: "Workers AI",
    description:
      "Run inference with frontier models like Kimi K2.7 — streaming, tool calling, and vision, all on Cloudflare's edge network.",
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93" />
        <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93" />
        <path d="M12 18v4" />
        <path d="M8 22h8" />
        <path d="M12 10v2" />
        <circle cx="12" cy="14" r="2" />
      </svg>
    ),
  },
  {
    title: "Edge-First Architecture",
    description:
      "Hono API worker with D1 database, KV storage, and R2 object store — zero cold starts, global distribution.",
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    title: "AI Gateway",
    description:
      "Built-in rate limiting, caching, and observability for AI requests. Monitor usage and control costs automatically.",
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: "Streaming Chat",
    description:
      "TanStack AI with real-time streaming responses. Type-safe message handling with Zod schemas across the stack.",
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const stack = [
  "React 19",
  "TanStack Router",
  "TanStack AI",
  "Hono",
  "Vite",
  "Tailwind CSS v4",
  "shadcn/ui",
  "Cloudflare Workers",
  "Workers AI",
  "D1",
  "KV",
  "R2",
  "Biome",
  "Vitest",
];

function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4 pt-8 pb-4 text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <Badge variant="secondary" className="text-sm">
            Open Source Starter Template
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Build AI Apps on{" "}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              Cloudflare
            </span>
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            A production-ready monorepo for building and deploying AI-powered single-page
            applications on the Cloudflare edge.
          </p>
          <div className="flex gap-3 pt-2">
            <Button asChild size="lg">
              <Link to="/chat">Try the Chat</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="/api/health" target="_blank" rel="noopener">
                Health Check
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-center">Features</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-center">Tech Stack</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {stack.map((tech) => (
            <Badge key={tech} variant="outline" className="text-sm">
              {tech}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}
