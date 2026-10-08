# Architecture

## Components

- `app/components/`: React workspace, source viewer, review forms, imports and questions.
- `lib/evidence.ts`: Deterministic record validation, normalization, timeline and disagreements.
- `lib/workflow.ts`: LangGraph review workflow with parallel analysis and a human interrupt.
- `lib/questions.ts`: Question graph, evidence retrieval, output checks and fallback behavior.
- `lib/ai.ts`: LangChain model adapters and structured outputs.
- `lib/store.ts`: PostgreSQL transactions; local file adapter for standalone development.
- `lib/session.ts`: Signed workspace cookie and browser-origin checks.
- `lib/service.ts`: Validated actions, scoped workflow IDs, bounded activity and revision checks.
- `mcp/`: Standard SDK server and five read-only tools.
- `data/patients.ts`: Three fictional cases with intentionally planted differences.

## Data flow

The browser reads `/api/workspace`. Every mutation goes through `/api/action` and a Zod discriminated union. The server gets the workspace ID from a signed cookie, never from a user-supplied workspace parameter. A database transaction locks the workspace row and checks the revision before saving.

Original records are append-only at the application level. Each claim carries a source ID, verbatim excerpt, event date, and context. Source-entry dates remain separate. A review decision stores its chosen source, explanation, reviewer label and timestamp. It does not rewrite source text.

The demo does not authenticate clinical staff. Reviewer names are user-entered labels and must not be described as verified identities.

## Temporal assumptions

Claims are compared only within the same structured key and context. A changed weight across separate visits is a time series, not automatically a conflict. Differing statements about the same episode require review. The importer must provide the context; the app does not infer identity or temporal equivalence from free text.

`validUntil` is optional and validated against the start date. The app presents dated statements; it does not claim that every historical statement remains currently true.

## Workflow consistency

A run stores its source fingerprint and source IDs. A new imported record invalidates approval of the old source set. A reviewer must start a new run. Run completion and issue review are separate: reviewing the overall brief does not silently close unresolved contradictions.

PostgreSQL checkpoint tables and application state are written through separate operations. The current demo is not a distributed exactly-once system. If a process fails between checkpoint completion and workspace save, recovery can require a new run. Side effects inside graph nodes are limited; original source data is never modified by a graph. A future durable worker should use an outbox and reconciliation job for this boundary.

## Retrieval and models

The default retrieval is bounded lexical matching, not embeddings. When a matched fact belongs to a contradictory context, both sides are included. Optional LangChain synthesis returns a typed statement list with source IDs. Unknown citations and omitted competing sources trigger deterministic fallback. The system does not fetch arbitrary URLs or execute instructions found in records.

A semantic factuality evaluator, source-span entailment checks, stronger adversarial evaluation, model risk controls and clinical review remain required for any serious use.
