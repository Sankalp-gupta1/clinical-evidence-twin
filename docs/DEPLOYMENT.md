# Deployment

Use a new Vercel project for this repository. The Next.js app is at the repository root. Do not change or reuse an unrelated project.

## Required setup

1. Link the `clinical-evidence-twin` project in the intended account.
2. Provision a dedicated PostgreSQL database. Choose a free plan explicitly; do not enable paid upgrades by accident.
3. Set `DATABASE_URL` using the provider's verified TLS configuration. Do not disable certificate verification.
4. Generate a random `SESSION_SECRET` with at least 32 random bytes. Set it as a server secret in Vercel for each environment that can save data.
5. Pull environment variables into `.env.local` through the Vercel CLI. Never print or commit that file.
6. Run the migration with the environment loaded:

```bash
node --env-file=.env.local --import tsx scripts/migrate.ts
```

7. Run `npm test`, `npm run typecheck`, and `npm run build`.
8. Deploy the `main` branch. Verify `/api/health`, then create a review note, refresh the page, run the workflow, and resume it.

## Environment keys

| Key                | Purpose                                    | Required                                   |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| DATABASE_URL       | Workspace data and checkpoint storage      | Hosted writes                              |
| SESSION_SECRET     | Signs the anonymous demo workspace cookie  | Hosted writes                              |
| AI_ENABLED         | Explicitly enables optional model requests | Defaults to false                          |
| AI_MODEL           | Exact supported provider/model ID          | AI mode                                    |
| GOOGLE_API_KEY     | Direct Gemini authentication               | If using Gemini directly                   |
| AI_GATEWAY_API_KEY | Gateway authentication                     | Optional if valid Vercel OIDC is available |
| MCP_ACCESS_TOKEN   | Bearer authentication for hosted MCP       | Hosted MCP                                 |
| MCP_WORKSPACE_ID   | Exact workspace exposed to MCP             | Optional; otherwise seed data only         |

No secret belongs in a `NEXT_PUBLIC_` variable.

## Local and deployed behavior

Local standalone development does not depend on Vercel services. It uses a file store and a clearly labeled memory checkpoint. Vercel's serverless filesystem is not used for durable writes. If database setup is incomplete, the deployed app stays in read-only preview mode.

## Before real use

This deployment is for fictional demo records. Real patient use needs clinician-led validation, identity and access management, retention and deletion policies, formal threat modelling, audit controls, external review, and the applicable agreements and approvals. A signed anonymous browser cookie is not staff authentication. Local file storage is single-process development support, not a production database.
