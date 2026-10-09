# Architecture

## Components

- `app/components/`: React workspace, source viewer, review forms, imports and questions.
- `lib/evidence.ts`: Deterministic record validation, normalization, timeline and disagreements.
- `lib/workflow.ts`: LangGraph review workflow with parallel analysis and a human interrupt.
- `lib/questions.ts`: Question graph, evidence retrieval, output checks and fallback behavior.
- `lib/ai.ts`: LangChain model adapters and structured outputs.
- `lib/store.ts`: PostgreSQL transactions; local file adapter for standalone development.
- `lib/auth.ts`: Better Auth sessions, password policy, authentication rate limits and optional account email.
- `lib/hospitals.ts`: Hospital membership, owner-approved access requests and transactional authorization.
- `lib/permissions.ts`: Owner/reviewer/viewer capability checks.
- `lib/schema.ts`: Additive hospital, membership, audit and usage schema.
- `lib/session.ts`: Browser-origin checks and the legacy local session helper (not used by hospital APIs).
- `lib/service.ts`: Validated actions, scoped workflow IDs, bounded activity and revision checks.
- `mcp/`: Standard SDK server and five read-only tools.
- `data/patients.ts`: Three fictional cases with intentionally planted differences.

## Data flow

The public `/demo` reads only the fixed seed workspace. Its question endpoint uses that same data and explicitly disables model calls. It cannot read a hospital workspace even when the caller is signed in.

Hospital pages and every protected API verify the Better Auth database session. The requested hospital ID is untrusted: the server joins it to the signed-in user's membership before reading any records. Mutations require owner or reviewer access. A transaction holds the membership row while locking the workspace row and checking its revision. Revocation and role changes serialize against in-flight writes. Unknown roles fail closed.

Owner operations lock the owner's membership row, serializing access approvals and membership limits. Only the owner can access the join code, pending requests, or access audit. Requests are never auto-approved, and cannot be approved from a different hospital. Owner self-removal and role changes are blocked. The account identity is substituted server-side for every stored review author and audit actor.

A separate small connection pool handles checkpoints and AI request accounting, so it does not wait for the same connection pool held by the enclosing workspace transaction.

Original records are append-only at the application level. Each claim carries a source ID, verbatim excerpt, event date, and context. Source-entry dates remain separate. A review decision stores its chosen source, explanation, reviewer label and timestamp. It does not rewrite source text.

Accounts authenticate possession of an account password, not clinical credentials. Self-entered names and unverified emails are not identity proof. Before granting access, the owner must confirm the colleague outside the app. The pilot does not implement clinical credential verification, enterprise SSO, MFA or a hospital identity-provider integration.

## Temporal assumptions

Claims are compared only within the same structured key and context. A changed weight across separate visits is a time series, not automatically a conflict. Differing statements about the same episode require review. The importer must provide the context; the app does not infer identity or temporal equivalence from free text.

`validUntil` is optional and validated against the start date. The app presents dated statements; it does not claim that every historical statement remains currently true.

## Workflow consistency

A run stores its source fingerprint and source IDs. A new imported record invalidates approval of the old source set. A reviewer must start a new run. Run completion and issue review are separate: reviewing the overall brief does not silently close unresolved contradictions.

PostgreSQL checkpoint tables and application state are written through separate operations. The current demo is not a distributed exactly-once system. If a process fails between checkpoint completion and workspace save, recovery can require a new run. Side effects inside graph nodes are limited; original source data is never modified by a graph. A future durable worker should use an outbox and reconciliation job for this boundary.

## Retrieval and models

The default retrieval is bounded lexical matching, not embeddings. When a matched fact belongs to a contradictory context, both sides are included. Optional LangChain synthesis returns a typed statement list with source IDs. Unknown citations and omitted competing sources trigger deterministic fallback. The system does not fetch arbitrary URLs or execute instructions found in records.

A semantic factuality evaluator, source-span entailment checks, stronger adversarial evaluation, model risk controls and clinical review remain required for any serious use.
