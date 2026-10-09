# Safety and evaluation boundaries

The application uses synthetic data. It provides record organization and evidence comparison, not diagnosis or treatment advice.

## Implemented checks

- Exact patient identifier matching and scoped retrieval.
- Source quotes must exist verbatim.
- Duplicate IDs and invalid dates are rejected.
- Unit conversion preserves the original numeric value and unit.
- Unsupported units are not guessed.
- Opposing statements remain visible.
- AI-generated text is not written into factual memory.
- Unknown citations and omitted competing sources cause fallback.
- Common direct diagnosis/treatment requests receive a scope reminder.
- Human approval is required to complete an evidence workflow.
- Hosted MCP requires a constant-time checked bearer token and exposes read-only tools.
- Browser writes require a matching Origin and a valid Better Auth database session.
- Every hospital read checks membership. Every write checks reviewer/owner permission.
- Review author and audit actor are derived server-side, not accepted as client identity.
- Database session lookup avoids a stale cookie cache after sign-out.
- A hospital code only permits requesting access; an owner must approve it.
- Public demo requests never access hospital records or call a model.
- Shared AI request accounting limits total model requests across hospitals.

The keyword scope check is not a comprehensive medical-content classifier. Citation existence does not prove semantic correctness. Context fields are supplied during import. A `synthetic: true` flag is an input contract, not an automated PHI detector. No claim of HIPAA compliance, clinical validation or regulatory approval is made.

## Evaluation cases

1. Conflicting allergy records: include both original sources.
2. Contradictory medication status: flag, without choosing an instruction.
3. Different procedure dates: preserve both candidate dates.
4. Equivalent measurements: normalize without a false conflict.
5. Missing appointment: say it is absent in the supplied set, not absent in reality.
6. Unanswerable question: do not invent evidence.
7. Another patient ID: reject the join.
8. Invalid quote: reject the import.
9. Stale browser revision: reject the write.
10. Separate graph threads: return no other workspace's state.
11. Human interrupt: never reach finalization before a valid review response.
12. New record after a run: require a new review of the updated source set.

For real deployment, extend this into a clinician-authored omission dataset, adversarial prompt-injection suite, source entailment evaluation, access-control assessment and operational recovery drills.

## Business and security limitations

The application has account authentication and hospital membership checks, but no enterprise SSO, MFA, clinical credential verification, database row-level security, formal penetration test, retention automation or billing system. Team isolation is enforced in the application layer. Email delivery is optional; unverified email addresses are labeled accordingly. An owner must confirm each colleague outside the app. The access log and review history are application audit records, not a cryptographically immutable compliance audit. Record exports are downloaded by the browser and are not separately audited.
