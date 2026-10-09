# Clinical Evidence Twin

A clear, source-linked workspace for understanding a changing set of patient records. Built with Next.js, TypeScript, LangGraph, LangChain, PostgreSQL and the MCP SDK.

**This is a hospital-team pilot with synthetic data. It does not diagnose, prescribe, or recommend treatment changes. Do not upload real patient records.**

## What the product does

A clinician or reviewer often receives records from several teams. Dates can differ, a medication list may conflict with a discharge note, and important information can be missing. This workspace keeps the original text, organizes the timeline, highlights differences, and records the reviewer's reasoning.

Start with **Mira Sen**, a fictional case containing three disagreements and one missing follow-up date. **Leela Rao** demonstrates equivalent measurements in different units without creating false conflicts.

| View              | What it helps you do                                      |
| ----------------- | --------------------------------------------------------- |
| Overview          | See record coverage and the next items to check           |
| Patient timeline  | Separate event dates from dates notes were entered        |
| Source records    | Open the original text and its exact evidence quotes      |
| Needs review      | Compare both sides and save a written decision            |
| Saved memory      | Read source-linked statements and their review history    |
| Evidence workflow | Run checks, pause for a person, and resume after review   |
| Ask the evidence  | Find statements and open the sources supporting an answer |

## Hospital accounts and team access

The public homepage explains the product. **Explore the demo** opens sample records without an account. Public source search is available, but hospital reviews and workflows require sign-in.

Once database setup is complete:

1. Create an account, then create a hospital workspace or request access using its hospital code.
2. Open **My hospitals** to choose a workspace. Every hospital starts with its own copy of three fictional cases.
3. Follow **What to do next** inside a case: compare records, save a review, run the workflow, review the brief, and export.
4. Owners use **Team & access** to approve requests, change roles, and remove access. A code only permits requesting access; it never opens records.
5. Use **Sign out** to revoke the current database session. The app checks membership on every protected request.

| Role     | Can do                                                                              |
| -------- | ----------------------------------------------------------------------------------- |
| Owner    | Review cases, export, approve colleagues, manage roles and view access history      |
| Reviewer | Read evidence, add synthetic records, ask questions, save reviews and run workflows |
| Viewer   | Read evidence and export a brief; cannot save changes                               |

Review authorship comes from the authenticated account. It is not a claim that the person is a licensed clinician. Owners must confirm colleagues outside the app before approving access. Email verification and recovery are optional integrations and are clearly labeled when unavailable.

[Read the simple user guide](docs/USER_GUIDE.md).

## Start locally

Requirements: Node.js 24 LTS and npm. No paid API is needed for the evidence-search mode.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Without credentials the app serves the landing page and a read-only demo with source search. To use accounts and saved hospital workspaces, configure PostgreSQL, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` in `.env.local`, run the migration, then restart the app. See [Deployment](docs/DEPLOYMENT.md). The local file adapter remains available for isolated service tests and CLI development; web accounts do not use it.

For a production build:

```bash
npm run build
npm start
```

For tests:

```bash
npm test
npm run typecheck
```

## A five-minute demo

1. Sign in and open your hospital workspace. Choose Mira Sen and open **Needs review**. Public visitors can compare sources but cannot save reviews.
2. Open each source chip in the allergy-history disagreement. Compare the exact source text.
3. Choose **Keep it open**, explain what you need, and save the note.
4. Ask **Which records disagree?** The answer includes the competing sources.
5. Open **Evidence workflow**, run the checks, and review the brief. The actual LangGraph execution pauses at a human-review interrupt.
6. Add the built-in sample JSON record to supply a fictional follow-up date. The missing-item check updates. Earlier workflow runs remain tied to their original source set.
7. Export a readable Markdown brief or a complete JSON bundle.

## How the graph works

```mermaid
flowchart TD
  A[Validate patient and quotes] --> B[Normalize units]
  B --> C[Build timeline]
  B --> D[Compare statements]
  B --> E[Find missing items]
  C --> F[Assemble brief]
  D --> F
  E --> F
  F --> G[Pause for human review]
  G --> H[Save reviewed workflow]
```

This is a real LangGraph `StateGraph`, with parallel branches, a join, a typed interrupt response, thread-scoped checkpoints, and `Command({ resume })`. A second graph handles questions: scope check → retrieval → optional LangChain synthesis → citation validation.

## AI mode is explicit

Without a model connection, answers use deterministic evidence retrieval. The UI labels them **Evidence search**. It never pretends a model is running.

Optional AI summaries use LangChain with Gemini or an OpenAI-compatible Vercel AI Gateway endpoint. Set `AI_ENABLED=true`, a supported `AI_MODEL`, and the appropriate server credential. Outputs must cite known sources; if a conflict's competing source is omitted, the app falls back to original evidence. AI output is never promoted into patient memory automatically. This is a useful structural guardrail, not a guarantee that every generated sentence is accurate.

The pilot limits question frequency per hospital and bounds model output. A shared database counter caps model requests across the deployment (100 per day by default, including unsuccessful attempts). This is a request cap, not a currency budget. Provider spending limits and platform-level abuse controls still need operator configuration. Public demo questions never call a model.

## Durable deployment

See [Deployment](docs/DEPLOYMENT.md). On Vercel, accounts and writes require `DATABASE_URL`, a strong `BETTER_AUTH_SECRET`, and the correct production `BETTER_AUTH_URL`. PostgreSQL stores accounts, sessions, hospital memberships, records, access history and LangGraph checkpoints. `vercel.json` runs additive migrations during the build when account configuration is present.

Without a database, Vercel serves a clearly labeled read-only preview. No durable save is claimed in that mode. Source search stays available in the public demo even without a model or database.

## MCP

Five read-only tools are implemented: `list_synthetic_cases`, `get_evidence_timeline`, `search_evidence`, `list_review_items`, and `read_source`.

```bash
npm run mcp
```

The stdio server uses the original synthetic examples unless `MCP_WORKSPACE_ID` is explicitly configured. The hosted `/api/mcp` route requires `Authorization: Bearer <MCP_ACCESS_TOKEN>`. Hospital access additionally requires `MCP_ALLOW_HOSPITAL_ACCESS=true` and an explicit `MCP_WORKSPACE_ID`; otherwise only seed data is exposed. This is a server-configured integration credential, not per-user MCP OAuth. No tools edit sources, prescribe, or make clinical decisions. See [MCP setup](docs/MCP.md).

## Engineering choices and limits

- Match exact patient IDs. No fuzzy patient matching.
- Compare values only when the structured key and event context match.
- Keep every original statement. A newer note is not automatically more trustworthy.
- Convert only grams → kilograms and metres → centimetres. Unsupported units remain untouched.
- Preserve event dates and source-entry dates separately.
- Validate imported JSON and require every evidence quote to exist verbatim in the supplied text.
- Reviewer selection records a preference; it does not establish verified clinical truth.
- Use Better Auth database sessions, password hashing, database-backed authentication rate limits, and server-side hospital membership checks. Session cookie caching is disabled so logout/revocation takes effect on subsequent requests.
- Use revision checks and a row lock to prevent accidental overwrites from stale browser tabs.
- Keep original source text out of routine server logs. No analytics SDK is added.
- Imports support structured synthetic JSON. OCR, arbitrary PDF extraction, FHIR/EHR integrations, terminology services and external clinical-reference retrieval are not implemented.
- Hospital authentication and PostgreSQL checkpoints are covered by embedded-PostgreSQL integration tests. Hosted storage, email and AI still require live configuration and separate verification. This repository does not claim regulatory certification or production clinical readiness.

More detail: [Architecture](docs/ARCHITECTURE.md), [Safety and evaluation](docs/SAFETY.md), [Verification](docs/VERIFICATION.md).
