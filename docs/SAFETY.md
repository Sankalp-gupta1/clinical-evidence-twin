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
- Browser writes require a matching Origin and a valid session.

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
