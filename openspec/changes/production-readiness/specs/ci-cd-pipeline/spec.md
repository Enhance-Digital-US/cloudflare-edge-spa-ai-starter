# Spec Delta

## ADDED Requirements

### Requirement: Deployment via Workers Builds
Deployments SHALL be performed by Cloudflare Workers Builds, connected to the repository, with one Worker per environment. Merges to `main` SHALL deploy to staging. Production SHALL deploy from a dedicated `production` branch. Preview builds SHALL be enabled only on the staging Worker. No Cloudflare credentials SHALL be stored in the source repository or in GitHub secrets.

#### Scenario: Merge to main
- **WHEN** a commit lands on `main`
- **THEN** the staging Worker is built and deployed, and production is unchanged

#### Scenario: Promote to production
- **WHEN** the `production` branch is fast-forwarded to a tested commit
- **THEN** the production Worker is built and deployed from that commit

#### Scenario: Pull request preview
- **WHEN** a pull request branch is pushed
- **THEN** a preview of the staging Worker is created for that branch, and production resources are not touched

### Requirement: Database migrations before deploy
Each environment's deploy SHALL apply pending D1 migrations to that environment's database before the new Worker version is deployed. A migration failure SHALL prevent the deploy.

#### Scenario: Deploy with a pending migration
- **WHEN** a release adds a new migration file
- **THEN** the migration is applied to the target environment's database before the Worker is deployed

### Requirement: Durable Object class changes deploy atomically
Releases that create, rename or delete Durable Object classes SHALL be deployed with a full deploy, not an uploaded version or a gradual rollout.

#### Scenario: Release adding a Durable Object class
- **WHEN** a release adds a Durable Object class migration
- **THEN** it is shipped with a full deploy so the class migration is applied

## MODIFIED Requirements

### Requirement: PR quality checks
Pull requests and pushes to `main` SHALL trigger a GitHub Actions workflow that runs lint, typecheck, test, build, and dry-run deploys of the production and staging configurations. The workflow MUST fail if any step fails. It MUST succeed on a clean checkout, with no generated files committed, and MUST run without Cloudflare credentials. A newer run for the same ref SHALL cancel an in-progress one.

#### Scenario: PR with lint errors
- **WHEN** a pull request contains files with lint violations
- **THEN** the CI workflow fails at the lint step and blocks the PR

#### Scenario: PR passing all checks
- **WHEN** a pull request passes lint, typecheck, test, build and both dry-run deploys
- **THEN** the CI workflow reports success

#### Scenario: Clean checkout
- **WHEN** CI runs on a fresh clone in which the generated route tree does not exist
- **THEN** typecheck generates it and passes

#### Scenario: No Cloudflare credentials
- **WHEN** CI runs with no Cloudflare API token or account ID available
- **THEN** tests and dry-run deploys still complete successfully

#### Scenario: Invalid environment configuration
- **WHEN** a change makes the production, staging or preview Worker configuration invalid
- **THEN** the dry-run deploy step fails

## REMOVED Requirements

### Requirement: Automated deployment on merge
**Reason**: Deploys moved to Cloudflare Workers Builds, which supports per-environment Workers and per-branch previews, and keeps deploy credentials out of GitHub.
**Migration**: Connect the repository to the `cf-ai-spa-staging` and `cf-ai-spa` Workers in the Cloudflare dashboard, using the deploy commands documented in the README. `.github/workflows/deploy.yml` has been deleted.

### Requirement: Secrets configuration
**Reason**: GitHub Actions no longer deploys, so it needs no Cloudflare credentials.
**Migration**: Remove the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Runtime secrets are set per environment with `wrangler secret put` and `wrangler preview base-config secret put`.
