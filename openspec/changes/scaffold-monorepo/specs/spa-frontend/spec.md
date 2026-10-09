# Spec Delta

## Purpose

Defines the React single-page application's routing, rendering, design system integration, and development experience requirements.

## ADDED Requirements

### Requirement: File-based client-side routing
The SPA SHALL use TanStack Router with file-based route definitions. Routes are determined by the file structure under a `routes/` directory, and the route tree is auto-generated.

#### Scenario: New route added via file
- **WHEN** a developer creates a new `.tsx` file in the `routes/` directory
- **THEN** the route is automatically available in the application without manual registration

#### Scenario: Client-side navigation
- **WHEN** a user navigates between routes within the SPA
- **THEN** navigation occurs without a full page reload

### Requirement: SPA fallback for client-side routing
All requests that do not match a static asset or API route SHALL serve the SPA's `index.html`, enabling client-side routing to handle the path.

#### Scenario: Deep link to SPA route
- **WHEN** a user directly navigates to a deep route URL (e.g., `/chat`)
- **THEN** the server responds with `index.html` and TanStack Router renders the correct route

### Requirement: Design system via shared UI package
The SPA SHALL consume UI components from the `packages/ui` package, which provides shadcn/ui components styled with Tailwind CSS v4.

#### Scenario: Using a shared component
- **WHEN** the SPA imports a `Button` component from `@cf-ai-spa/ui`
- **THEN** the component renders with the design system's styles applied

### Requirement: Development server with API proxy
The SPA development server SHALL proxy API requests to the Worker dev server, enabling frontend and backend to run as separate processes during development.

#### Scenario: API call during development
- **WHEN** the SPA makes a fetch request to `/api/health` during local development
- **THEN** the request is proxied to the Worker dev server and the response is returned to the SPA
