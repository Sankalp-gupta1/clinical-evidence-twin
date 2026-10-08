import {
  Annotation,
  Command,
  END,
  START,
  StateGraph,
  MemorySaver,
  interrupt,
} from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { createHash } from 'node:crypto';
import { patients } from '@/data/patients';
import {
  conflictIssues,
  missingIssues,
  normalizeSources,
  timelineFor,
  validateSources,
} from './evidence';
import { getPool } from './store';
import { approvalSchema, type Evidence, type Issue, type Source, type RunEvent } from './types';

export function sourceFingerprint(sources: Source[]) {
  return createHash('sha256').update(JSON.stringify(sources)).digest('hex');
}
const event = (node: string, title: string, detail: string): RunEvent => ({
  node,
  title,
  detail,
  at: new Date().toISOString(),
});
const State = Annotation.Root({
  patientId: Annotation<string>(),
  sources: Annotation<Source[]>(),
  evidence: Annotation<Evidence[]>(),
  conflicts: Annotation<Issue[]>(),
  missing: Annotation<Issue[]>(),
  timeline: Annotation<ReturnType<typeof timelineFor>>(),
  brief: Annotation<string>(),
  approved: Annotation<boolean>(),
  reviewerNote: Annotation<string>(),
  events: Annotation<RunEvent[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
});
export function makeGraph(checkpointer: MemorySaver | PostgresSaver) {
  return new StateGraph(State)
    .addNode('validate', (state) => {
      validateSources(state.sources, state.patientId);
      return {
        events: [
          event(
            'validate',
            'Check patient and sources',
            `${state.sources.length} records match the exact patient ID. Every quote exists in its source.`,
          ),
        ],
      };
    })
    .addNode('normalize', (state) => {
      const evidence = normalizeSources(state.sources);
      return {
        evidence,
        events: [
          event(
            'normalize',
            'Keep original values and normalize units',
            `${evidence.filter((e) => e.conversion).length} unit conversions. Original measurements remain attached.`,
          ),
        ],
      };
    })
    .addNode('build_timeline', (state) => ({
      timeline: timelineFor(state.evidence),
      events: [
        event(
          'timeline',
          'Build the evidence timeline',
          'Clinical event dates are kept separate from the dates notes were entered.',
        ),
      ],
    }))
    .addNode('check_conflicts', (state) => {
      const conflicts = conflictIssues(state.evidence, state.patientId);
      return {
        conflicts,
        events: [
          event(
            'conflicts',
            'Compare statements',
            `${conflicts.length} disagreements found within matching event contexts.`,
          ),
        ],
      };
    })
    .addNode('check_missing', (state) => {
      const patient = patients.find((p) => p.id === state.patientId);
      if (!patient) throw new Error('Unknown patient');
      const missing = missingIssues(state.evidence, patient);
      return {
        missing,
        events: [
          event(
            'missing',
            'Find missing information',
            `${missing.length} expected items are absent from this record set.`,
          ),
        ],
      };
    })
    .addNode('assemble', (state) => ({
      brief: `${state.sources.length} records contain ${state.evidence.length} source-linked statements across ${state.timeline.length} dates. ${state.conflicts.length} disagreements and ${state.missing.length} missing items need a reviewer. No clinical conclusion has been made.`,
      events: [
        event(
          'assemble',
          'Assemble a review brief',
          'The brief describes evidence coverage and gaps. It does not diagnose or change treatment.',
        ),
      ],
    }))
    .addNode('review', (state) => {
      const response = interrupt(
        {
          kind: 'evidence_review',
          message: 'Review the source-linked brief before saving this workflow as reviewed.',
          brief: state.brief,
          issueIds: [...state.conflicts, ...state.missing].map((i) => i.id),
        },
        { responseSchema: approvalSchema },
      );
      return {
        approved: response.approved,
        reviewerNote: response.note,
        events: [
          event('review', 'Human review recorded', `${response.reviewer}: ${response.note}`),
        ],
      };
    })
    .addNode('finalize', () => ({
      events: [
        event(
          'finalize',
          'Save reviewed workflow',
          'The workflow is reviewed. Individual disagreements remain open until separately documented.',
        ),
      ],
    }))
    .addEdge(START, 'validate')
    .addEdge('validate', 'normalize')
    .addEdge('normalize', 'build_timeline')
    .addEdge('normalize', 'check_conflicts')
    .addEdge('normalize', 'check_missing')
    .addEdge(['build_timeline', 'check_conflicts', 'check_missing'], 'assemble')
    .addEdge('assemble', 'review')
    .addEdge('review', 'finalize')
    .addEdge('finalize', END)
    .compile({ checkpointer });
}
let graph: ReturnType<typeof makeGraph> | undefined;
export function getGraph() {
  if (!graph) {
    const pool = getPool();
    graph = makeGraph(pool ? new PostgresSaver(pool) : new MemorySaver());
  }
  return graph;
}
export async function startWorkflow(patientId: string, sources: Source[], threadId: string) {
  const graph = getGraph();
  await graph.invoke(
    { patientId, sources, events: [] },
    { configurable: { thread_id: threadId }, recursionLimit: 25 },
  );
  const snapshot = await graph.getState({ configurable: { thread_id: threadId } });
  return snapshot.values as typeof State.State;
}
export async function resumeWorkflow(threadId: string, approval: unknown) {
  const graph = getGraph();
  const config = { configurable: { thread_id: threadId }, recursionLimit: 25 };
  const before = await graph.getState(config);
  if (!before.next.length)
    throw new Error(
      'This workflow cannot be resumed. It is complete or its local checkpoint was lost. Start a new review.',
    );
  await graph.invoke(new Command({ resume: approvalSchema.parse(approval) }), config);
  return (await graph.getState(config)).values as typeof State.State;
}
