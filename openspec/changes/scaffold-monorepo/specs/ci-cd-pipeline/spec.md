# Spec Delta

## Purpose

Defines the GitHub Actions CI/CD pipeline for automated quality checks on pull requests and deployment to Cloudflare on merge to main.

## ADDED Requirements

### Requirement: PR quality checks
Pull requests SHALL trigger a GitHub Actions workflow that runs lint, typecheck, and test steps. The workflow MUST fail if any step fails.

#### Scenario: PR with lint errors
- **WHEN** a pull request contains files with lint violations
- **THEN** the CI workflow fails at the lint step and blocks the PR

#### Scenario: PR passing all checks
- **WHEN** a pull request passes lint, typecheck, and test steps
- **THEN** the CI workflow reports success

### Requirement: Automated deployment on merge
Pushes to the `main` branch SHALL trigger a GitHub Actions workflow that builds the SPA, then deploys the Worker and static assets to Cloudflare via `wrangler deploy`.

#### Scenario: Successful deployment
- **WHEN** a commit is pushed to `main` and all checks pass
- **THEN** the workflow builds the SPA and deploys the Worker with static assets to Cloudflare

#### Scenario: Build failure prevents deploy
- **WHEN** the SPA build or typecheck fails during the deploy workflow
- **THEN** the deployment step is skipped and the workflow reports failure

### Requirement: Secrets configuration
The CI/CD workflows SHALL require `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets. The workflows MUST NOT hardcode credentials.

#### Scenario: Missing deployment secret
- **WHEN** the deploy workflow runs without `CLOUDFLARE_API_TOKEN` configured
- **THEN** the `wrangler deploy` step fails with an authentication error
