# Verification record

Updated 9 October 2026.

## Implemented flow

Homepage → account → hospital membership → scoped evidence API → PostgreSQL workspace → source-linked review → LangGraph human pause/resume.

## Automated verification

- TypeScript strict check and Next.js production build passed.
- 29 tests passed, including embedded PostgreSQL integration tests with the actual Better Auth handler and application API routes.
- Sign-up, password hashing, wrong-password rejection, valid sign-in and server-side sign-out revocation passed.
- Foreign hospital IDs and anonymous access are rejected.
- Hospital codes produce pending requests, not access. Cross-hospital approvals are rejected.
- Viewer writes and self-escalation are rejected server-side.
- A reviewer-supplied false author name is replaced with the authenticated account identity.
- Saved notes persist and do not appear in another hospital; stale revisions are rejected.
- Removing a member immediately blocks their next read while preserving their review history.
- A new LangGraph instance resumes a paused workflow from PostgreSQL checkpoint tables; another hospital thread sees no state.
- The documented stdio MCP command starts and completes an SDK client handshake.
- Existing evidence, unit, quote, date, scope, MCP handshake and patient-isolation tests pass.

Embedded PostgreSQL tests are useful integration evidence, but do not prove hosted networking, TLS, concurrency under production load, live email, or model-provider behavior.

## Hosted status

The hospital-account update (commit `6d620cd`) reached **Ready** on Vercel and was opened at https://clinical-evidence-twin.vercel.app on 9 October 2026.

Live browser checks confirmed:

- The new landing page, demo, sign-in and sign-up screens render.
- A weight question reaches the deployed evidence API and returns source-linked statements for the fictional case.
- A review comparison shows both original allergy statements and their source dates.
- Opening a source displays its original supplied text.
- Public demo writes are disabled; account pages explain the missing setup and disable account submission.
- The homepage has no horizontal overflow at the tested 1348-pixel viewport. Mobile visual testing remains pending.

The browser check also identified two presentation fixes included in the next commit: make the homepage illustration match the actual case dates and distinguish read-only permissions from an active saving/loading state.

Live hospital saving is still blocked on database provisioning and the auth secret. The Neon marketplace terms require account-owner approval before provisioning can continue. Hospital creation, team management and login/logout have passed database-backed integration tests, but the hosted account flow cannot be tested until this setup is complete.

AI model calls, account email delivery and a live authenticated MCP client have not been verified. No claim of production clinical readiness is made.
