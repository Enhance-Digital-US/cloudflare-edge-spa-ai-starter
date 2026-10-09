---
name: add-ui-component
description: Add a new shadcn/ui component to the packages/ui package
---

## Add a shadcn/ui Component

1. Create the component file at `packages/ui/src/components/<name>.tsx`
   - Import `cn` from `../lib/utils.js`
   - Use `React.ComponentProps<>` for prop types (React 19 ref forwarding)
   - Follow existing patterns in `packages/ui/src/components/button.tsx`

2. If the component needs a Radix UI primitive:
   ```bash
   pnpm --filter @cf-ai-spa/ui add @radix-ui/react-<primitive>
   ```

3. Export the component from `packages/ui/src/index.ts`

4. Run checks:
   ```bash
   pnpm run typecheck
   pnpm run lint
   ```

5. The component is immediately available in `apps/web` via `import { ComponentName } from "@cf-ai-spa/ui"`

### AI Elements Components

AI Elements from `elements.ai-sdk.dev` are hand-ported (the shadcn CLI does not work with the current `components.json`).

1. Fetch the registry JSON: `curl -s "https://elements.ai-sdk.dev/api/registry/<name>.json"`
2. Extract the source from `files[0].content`
3. Rewrite imports: `@/registry/default/ui/x` → `../x.js`, `@/lib/utils` → `../../lib/utils.js`
4. Remove `"use client"` directives and any `import type ... from "ai"` — use local types instead
5. Save to `packages/ui/src/components/ai-elements/<name>.tsx`
6. Export from `packages/ui/src/ai-elements.ts` (NOT the main barrel — keeps streamdown/shiki out of the entry chunk)
7. Import in apps via `@cf-ai-spa/ui/ai-elements`

### Conventions
- Use `function` declarations, not `const` arrows
- Use Tailwind CSS v4 utility classes with shadcn color tokens (bg-primary, text-muted-foreground, etc.)
- Use `cva` from `class-variance-authority` for variant-based styling
- Keep components unstyled/headless where possible, using `cn()` for className merging
