# Deployment

The existing Vercel project is `clinical-evidence-twin`, connected to `Sankalp-gupta1/clinical-evidence-twin`, branch `main`, root `./`. Do not create a nested project or reuse an unrelated database.

## Required account setup

1. Create a dedicated PostgreSQL database through the Vercel Storage marketplace. Select the free plan explicitly. Provider terms must be accepted by the account owner; no paid upgrade is required by this code.
2. Connect it to this project. Let the integration provision `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; do not paste credentials into GitHub or chat. Runtime requests use the pooled URL. The migration process prefers the direct URL so its session advisory lock stays on one PostgreSQL connection; it rejects a Neon pooler URL if a direct URL is missing.
3. Generate a random `BETTER_AUTH_SECRET` with at least 32 random bytes and save it as a server-only Vercel secret. Do not use a sample, account password, or repository value.
4. Set `BETTER_AUTH_URL=https://clinical-evidence-twin.vercel.app` for Production. For local use set `http://localhost:3000`. Use a separate database and secret for previews; do not share production data with arbitrary preview builds.
5. Redeploy. `vercel.json` runs `npm run db:prepare` then the production build. The preparation script runs additive Better Auth, hospital, and LangGraph migrations, guarded by a PostgreSQL advisory lock. It skips account setup if required configuration is absent. A configured but failed migration fails the build.
6. Verify `/api/health`, then sign up, create a hospital, save a review, refresh, run and resume the evidence workflow, sign out, and confirm the old session no longer reads the workspace.

Migrations do not drop source data. Back up the database before future schema changes. Runtime credentials currently have schema privileges for build-time migration; a separate migration role and least-privilege runtime role are recommended before real deployment.

## Local account setup

Use a dedicated development PostgreSQL database and put the same keys in `.env.local`.

```bash
npm ci
node --env-file=.env.local --import tsx scripts/migrate.ts
npm run dev
```

The plain demo can run without these credentials. The test suite creates an isolated embedded PostgreSQL instance; no hosted credentials or paid API are needed for tests.

## Environment keys

| Key                       | Purpose                                                              | Required                       |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| DATABASE_URL              | Accounts, hospital data and workflow checkpoints                     | Accounts/saved reviews         |
| DATABASE_URL_UNPOOLED     | Direct PostgreSQL connection for build-time migrations               | When runtime uses Neon pooling |
| BETTER_AUTH_SECRET        | Random secret for Better Auth                                        | Accounts                       |
| BETTER_AUTH_URL           | Canonical application origin                                         | Production accounts            |
| RESEND_API_KEY            | Optional account-email provider credential                           | Verification/recovery email    |
| EMAIL_FROM                | Verified sender address in the email provider                        | Verification/recovery email    |
| AI_ENABLED                | Explicitly enable model calls                                        | Defaults to false              |
| AI_MODEL                  | Exact supported provider/model ID                                    | AI summaries                   |
| GOOGLE_API_KEY            | Direct Gemini credential                                             | If using direct Gemini         |
| AI_GATEWAY_API_KEY        | Gateway credential                                                   | Or a valid Vercel OIDC token   |
| AI_DAILY_REQUEST_LIMIT    | Shared deployment request cap; 100 by default, max 1000              | Optional                       |
| MCP_ACCESS_TOKEN          | Strong bearer token for hosted MCP                                   | Hosted MCP                     |
| MCP_WORKSPACE_ID          | Exact hospital UUID for a configured integration                     | Optional                       |
| MCP_ALLOW_HOSPITAL_ACCESS | Explicitly permit that MCP integration to read the selected hospital | Defaults to false              |

No secret belongs in a `NEXT_PUBLIC_` variable. `SESSION_SECRET` is only used by the legacy local anonymous-session helper; it is not a substitute for hospital authentication.

## Account email

Email delivery is optional for the synthetic pilot. Without it, account creation and owner-approved team requests still work, but email verification and password recovery are unavailable. The UI says so and never pretends a reset email was sent. Owners cannot read or reset user passwords. Connect a verified sender before a wider pilot; the code supports Resend verification/reset messages. Do not send account emails to anyone as part of setup tests.

## Remaining operational work

This is a fictional-data pilot. Before real patient use: validate clinical behavior, use an approved identity provider and MFA, establish retention/deletion/backups, add monitoring and recovery drills, review infrastructure and data-processing agreements, and obtain the applicable approvals. No regulatory or clinical-readiness claim is made.
