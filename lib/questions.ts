import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'node:crypto';
import { searchEvidence, conflictIssues } from './evidence';
import { synthesize } from './ai';
import type { Answer, Evidence } from './types';
const State = Annotation.Root({
  question: Annotation<string>(),
  patientId: Annotation<string>(),
  evidence: Annotation<Evidence[]>(),
  retrieved: Annotation<Evidence[]>(),
  answer: Annotation<string>(),
  sourceIds: Annotation<string[]>(),
  mode: Annotation<Answer['mode']>(),
  warning: Annotation<string | undefined>(),
  blocked: Annotation<boolean>(),
  allowAI: Annotation<boolean>(),
});
export function evidenceAnswer(question: string, facts: Evidence[], patientId: string) {
  if (!facts.length)
    return {
      answer:
        'I could not find a matching statement in the supplied records. Try a specific topic, such as the procedure date, allergy history, or recorded weight. Missing evidence does not mean a condition is absent.',
      sourceIds: [],
    };
  const conflicts = conflictIssues(facts, patientId);
  return {
    answer: [
      ...facts.map(
        (f) =>
          `${f.label}: ${f.normalizedValue}${f.normalizedUnit ? ` ${f.normalizedUnit}` : ''} (event date: ${f.effectiveAt}). [${f.sourceId}]`,
      ),
      ...(conflicts.length
        ? [
            'These sources disagree. A reviewer needs to check the original records; this answer does not decide which statement is correct.',
          ]
        : []),
    ].join('\n\n'),
    sourceIds: [...new Set(facts.map((f) => f.sourceId))],
  };
}
const graph = new StateGraph(State)
  .addNode('scope', (s) => ({
    blocked:
      /\b(diagnose|diagnosis|prescribe|dosage|what treatment|should (i|we|they)|take this|stop taking)\b/i.test(
        s.question,
      ),
  }))
  .addNode('retrieve', (s) => {
    const top = /\b(disagree|conflict|contradict|difference|different)\b/i.test(s.question)
      ? conflictIssues(s.evidence, s.patientId).flatMap((issue) => issue.evidence)
      : searchEvidence(s.evidence, s.question);
    // Include every side of a retrieved disagreement, even if only one side ranked highly.
    const contexts = new Set(top.map((e) => `${e.key}::${e.context}`));
    const retrieved = s.evidence.filter((e) => contexts.has(`${e.key}::${e.context}`)).slice(0, 30);
    return { retrieved };
  })
  .addNode('draft', async (s) => {
    if (s.blocked)
      return {
        answer:
          'This workspace can explain what the records say, but it cannot diagnose, prescribe, or recommend treatment changes. Ask about a recorded fact or an unresolved difference between sources.',
        sourceIds: [],
        mode: 'Evidence search' as const,
      };
    const fallback = evidenceAnswer(s.question, s.retrieved, s.patientId);
    if (!s.retrieved.length) return { ...fallback, mode: 'Evidence search' as const };
    try {
      const generated = s.allowAI ? await synthesize(s.question, s.retrieved) : null;
      if (!generated || !generated.statements.length)
        return { ...fallback, mode: 'Evidence search' as const };
      const conflicting = conflictIssues(s.retrieved, s.patientId);
      const citations = new Set(generated.statements.flatMap((s) => s.sourceIds));
      if (conflicting.some((issue) => issue.evidence.some((e) => !citations.has(e.sourceId))))
        throw new Error('A conflicting source was omitted.');
      return {
        answer:
          generated.statements
            .map(
              (statement) =>
                `${statement.text} ${statement.sourceIds.map((id) => `[${id}]`).join(' ')}`,
            )
            .join('\n\n') + (generated.limitation ? `\n\n${generated.limitation}` : ''),
        sourceIds: [...citations],
        mode: 'AI summary' as const,
        warning: 'AI-written summary. Check the linked source text before relying on it.',
      };
    } catch {
      return {
        ...fallback,
        mode: 'Evidence search' as const,
        warning:
          'AI summary was unavailable or failed its citation checks. Original evidence is shown instead.',
      };
    }
  })
  .addNode('validate', (s) => {
    const allowed = new Set(s.retrieved.map((e) => e.sourceId));
    if (s.sourceIds.some((id) => !allowed.has(id))) throw new Error('Unknown citation.');
    return {};
  })
  .addEdge(START, 'scope')
  .addEdge('scope', 'retrieve')
  .addEdge('retrieve', 'draft')
  .addEdge('draft', 'validate')
  .addEdge('validate', END)
  .compile();
export async function answerQuestion(
  question: string,
  evidence: Evidence[],
  patientId: string,
  allowAI = true,
): Promise<Answer> {
  const result = await graph.invoke(
    { question, evidence, patientId, allowAI },
    { recursionLimit: 10 },
  );
  return {
    id: randomUUID(),
    question,
    answer: result.answer,
    sourceIds: result.sourceIds,
    mode: result.mode,
    warning: result.warning,
    createdAt: new Date().toISOString(),
  };
}
