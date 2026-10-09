# Go-live runbook

These steps take the template from "passes CI" to running in staging and production. Nothing here can be done from the repo alone: each step needs Docker, your Cloudflare account, or GitHub. The steps match the open tasks in section 7 of `openspec/changes/production-readiness/tasks.md`. Tick each task when its **Verify** check passes.

Run every command from the repository root. `<subdomain>` means your account's `workers.dev` subdomain. It appears in the URL that `wrangler deploy` prints, and in the dashboard under **Workers & Pages → Account details**.

| Step | Task | Needs | Touches production |
|---|---|---|---|
| [1. Sandbox locally](#1-sandbox-with-docker-locally-task-71) | 7.1 | Docker | No |
| [2. Staging](#2-stand-up-staging-task-72) | 7.2 | Cloudflare account (Workers Paid) | No |
| [3. Agent task on staging](#3-agent-task-on-staging-task-74) | 7.4 | Step 2 | No |
| [4. Repo, Workers Builds and PR preview](#4-repo-workers-builds-and-a-pr-preview-task-73) | 7.3 | GitHub repo, Cloudflare dashboard | No |
| [5. Production](#5-go-live-in-production-task-75) | 7.5 | Steps 2–4 | **Yes** |

---

## 1. Sandbox with Docker, locally (task 7.1)

`pnpm run dev` starts with containers disabled. This step uses the container-enabled variant.

1. Start Docker Desktop (`open -a Docker`) and wait until `docker info` succeeds.
2. Apply the local schema, then start the dev servers:
   ```bash
   pnpm exec wrangler d1 migrations apply DB --local
   pnpm run dev:containers
   ```
3. In a second terminal, sign up and keep the session cookie:
   ```bash
   B=http://localhost:5173
   curl -s -c /tmp/cf.jar -X POST $B/api/auth/sign-up/email \
     -H 'Content-Type: application/json' -H "Origin: $B" \
     -d '{"email":"sandbox-test@example.com","password":"correct-horse-battery","name":"Test"}'
   ```
4. Run the three checks. The first call starts the container, so it takes longer than the rest:
   ```bash
   # a) output
   curl -s -b /tmp/cf.jar -X POST $B/api/sandbox/exec -H 'Content-Type: application/json' \
     -d '{"code":"console.log(1 + 2)"}'
   # b) timeout (takes ~10 s)
   curl -s -b /tmp/cf.jar -X POST $B/api/sandbox/exec -H 'Content-Type: application/json' \
     -d '{"code":"while (true) {}"}'
   # c) no Internet
   curl -s -b /tmp/cf.jar -X POST $B/api/sandbox/exec -H 'Content-Type: application/json' \
     -d '{"code":"fetch(\"https://example.com\").then(r => console.log(r.status))"}'
   ```

**Verify:**
- a) returns `"stdout":"3\n"`, `"exitCode":0`, `"timedOut":false`
- b) returns `"timedOut":true`
- c) returns a non-zero `exitCode` with a network error in `stderr`, and no `200`

> If `wrangler dev` can't start the Cloudflare-managed `cloudflare/debian-trixie` image locally, record what happened and do this check on staging after step 2 instead. Durable Object-managed containers are in public beta.

---

## 2. Stand up staging (task 7.2)

### 2.1 Account prerequisites
- **Workers Paid plan**: dashboard → **Workers & Pages → Plans**. Containers require it.
- Confirm wrangler is logged in to the intended account:
  ```bash
  pnpm exec wrangler whoami
  ```

### 2.2 Create the staging resources
```bash
pnpm exec wrangler d1 create cf-ai-spa-db-staging
pnpm exec wrangler kv namespace create KV --env staging
pnpm exec wrangler r2 bucket create cf-ai-spa-bucket-staging
```
In `wrangler.jsonc`, replace these placeholders with the IDs printed above. Each one appears in **two** places: `env.staging` and `env.staging.previews`.
- `YOUR_STAGING_D1_DATABASE_ID`
- `YOUR_STAGING_KV_NAMESPACE_ID`

In `env.staging.previews.vars.BETTER_AUTH_ALLOWED_HOSTS`, replace `YOUR_SUBDOMAIN` with your workers.dev subdomain.

### 2.3 Create the staging AI Gateway
In the dashboard, go to **AI → AI Gateway → Create gateway** and create a gateway named **`cf-ai-spa-staging`**. Then set:
- **Caching:** off
- **Spend limits:**
  - one rule scoped by the custom metadata dimension `userId` (for example $5/day)
  - one total cap for the gateway (for example $20/day)

Without this gateway, chat fails with `Please configure AI Gateway`.

### 2.4 Apply migrations and deploy with secrets
Create a secrets file **outside the repo**. Never commit it.
```bash
cat > ~/cf-ai-spa-staging.secrets.env <<EOF
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://cf-ai-spa-staging.<subdomain>.workers.dev
EOF
```
Optionally add `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` or `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Each OAuth app's callback URL is `<BETTER_AUTH_URL>/api/auth/callback/<provider>`.

```bash
pnpm exec wrangler d1 migrations apply DB --remote --env staging
pnpm run build
pnpm exec wrangler deploy --env staging --secrets-file ~/cf-ai-spa-staging.secrets.env
```
Check that the URL wrangler prints matches `BETTER_AUTH_URL`. If it doesn't, fix it with `pnpm exec wrangler secret put BETTER_AUTH_URL --env staging`.

### 2.5 Preview secrets (needed before step 4)
Previews inherit nothing from staging, so give them the same secrets through the preview base configuration:
```bash
pnpm exec wrangler preview base-config secret put BETTER_AUTH_SECRET --env staging
pnpm exec wrangler preview base-config secret put BETTER_AUTH_URL --env staging   # the staging URL
```

### 2.6 Optional: email verification and password reset
```bash
pnpm exec wrangler email sending enable <your-domain>
```
Then set `EMAIL_FROM` (for example `noreply@<your-domain>`) under `env.staging.vars` and `env.staging.previews.vars`, and redeploy. Sign-up then requires email verification.

**Verify:**
```bash
S=https://cf-ai-spa-staging.<subdomain>.workers.dev
curl -s $S/api/health                     # → "environment":"staging"
curl -s -c /tmp/stg.jar -X POST $S/api/auth/sign-up/email -H 'Content-Type: application/json' \
  -H "Origin: $S" -d '{"email":"you@example.com","password":"correct-horse-battery","name":"You"}'
curl -s -b /tmp/stg.jar -X POST $S/api/ai/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Reply with exactly: pong"}]}'
```
- Health reports `staging`.
- Sign-up returns the user (or `token: null` if email verification is on; verify the address first).
- The chat stream contains `TEXT_MESSAGE_CONTENT` events, not `RUN_ERROR`.
- In the browser, `https://cf-ai-spa-staging.<subdomain>.workers.dev/chat` redirects to sign-in and chat works after you sign in.

---

## 3. Agent task on staging (task 7.4)

Use the session from step 2:
```bash
ID=$(curl -s -b /tmp/stg.jar -X POST $S/api/tasks -H 'Content-Type: application/json' \
  -d '{"prompt":"print the sum of 1 and 2","conversationId":"golive-check"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
# poll until it finishes
curl -s -b /tmp/stg.jar $S/api/tasks/$ID
curl -s -b /tmp/stg.jar $S/api/conversations/golive-check/messages
```

**Verify:**
- The task reaches `"status":"complete"`, and `output.result.stdout` contains `3`.
- The conversation has a `[task] …` user message and an assistant message containing the code and its output.
- In the dashboard, **Workflows → `cf-ai-spa-staging-agent-task`** shows the instance with three completed steps.

If it ends `errored` at `run in sandbox`, check that the plan includes Containers, and look in **Containers** in the dashboard for the `cf-ai-spa-staging-sandbox` application.

---

## 4. Repo, Workers Builds and a PR preview (task 7.3)

### 4.1 Commit and push
```bash
git add -A
git commit -m "Production-ready template: Better Auth, staging, DOs, Workflows, Sandbox"
git remote add origin git@github.com:<owner>/cf-ai-spa.git
git push -u origin main
git branch production && git push -u origin production
```
Before committing, check that `git status` doesn't list `.dev.vars` or any `*.secrets.env` file.

### 4.2 Connect Workers Builds
For **both** Workers, go to **Workers & Pages → Worker → Settings → Builds → Connect** and choose the repository:

| Setting | `cf-ai-spa-staging` | `cf-ai-spa` |
|---|---|---|
| Branch | `main` | `production` |
| Build command | `pnpm run build` | `pnpm run build` |
| Deploy command | `npx wrangler d1 migrations apply DB --remote --env staging && npx wrangler deploy --env staging` | `npx wrangler d1 migrations apply DB --remote --env="" && npx wrangler deploy --env=""` |
| Preview builds | **On**: `npx wrangler preview --env staging` | **Off** |

In GitHub, go to **Settings → Branches** and protect `main` and `production`, requiring the `CI` check. If `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` were ever added as repository secrets, delete them; CI doesn't need them.

### 4.3 Open a PR
Push a small change on a branch and open a PR against `main`.

**Verify:**
- The `CI` check passes.
- Workers Builds comments a preview URL on the PR (`<branch>-cf-ai-spa-staging.<subdomain>.workers.dev`).
- Sign-up with email and password works on the preview hostname, and chat streams a reply.
- Production is untouched. The user count stays the same before and after testing the preview:
  ```bash
  pnpm exec wrangler d1 execute cf-ai-spa-db --remote --command "SELECT count(*) FROM user"
  ```

Notes:
- Social login doesn't work on previews, because OAuth callbacks must be registered per hostname.
- Workflow changes in a PR run staging's Workflow code until they are merged.

---

## 5. Go live in production (task 7.5)

1. Repeat **2.2–2.4** for production:
   - Resource names: `cf-ai-spa-db`, `KV` (no `--env`), `cf-ai-spa-bucket`.
   - Replace the top-level `YOUR_D1_DATABASE_ID` and `YOUR_KV_NAMESPACE_ID`.
   - Gateway name: **`cf-ai-spa-production`**.
   - Use `--env=""` in place of `--env staging` in every command.
   - `BETTER_AUTH_URL` is your production URL (custom domain or `https://cf-ai-spa.<subdomain>.workers.dev`).
2. Decide the sign-up policy. To restrict sign-up, set `AUTH_ALLOWED_EMAIL_DOMAINS` in the top-level `vars`. **It's empty by default, which means anyone can sign up.**
3. Merge to `main`, check staging, then fast-forward `production`:
   ```bash
   git checkout production && git merge --ff-only main && git push
   ```

**Verify:**
- `curl -s https://<production-url>/api/health` reports `"environment":"production"`.
- After a chat request, **AI Gateway → `cf-ai-spa-production` → Logs** shows the request with metadata `userId` and `environment: production`.
- Workers Observability shows logs for the request, and traces appear for about 10% of requests.

---

## After go-live

1. Tick tasks 7.1–7.5 in `openspec/changes/production-readiness/tasks.md`.
2. Archive the OpenSpec changes **in this order**. The second one's spec deltas modify the first one's specs.
   ```bash
   openspec archive scaffold-monorepo -y
   openspec archive production-readiness -y
   ```
3. Delete the local secrets files (`~/cf-ai-spa-*.secrets.env`), or move them into a password manager.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Chat stream shows `RUN_ERROR … Please configure AI Gateway` | The environment's gateway doesn't exist | Create the gateway named in `AI_GATEWAY_ID` (step 2.3) |
| `403` on sign-in or sign-up | The request origin differs from `BETTER_AUTH_URL` | Set `BETTER_AUTH_URL` to the exact URL users visit. For previews, check `BETTER_AUTH_ALLOWED_HOSTS` |
| Error `1101` on a preview | A binding is missing from `env.staging.previews` | Add it there, pointed at a staging resource |
| `503 Sandbox is not available` | Containers are disabled (`pnpm run dev`) or not on the plan | Use `pnpm run dev:containers` locally, or check the Workers Paid plan |
| `429 Too many requests` | Rate limit hit (10/min per IP on auth, 20/min per user on AI) | Wait 60 s, or raise `simple.limit` in `ratelimits` |
| `wrangler dev` fails with a Docker CLI error | Containers are enabled without Docker | Use `pnpm run dev`, or start Docker |
| Deploy fails on a Durable Object migration | A class change was shipped with `versions upload` | Use `wrangler deploy` (the documented deploy commands do) |
