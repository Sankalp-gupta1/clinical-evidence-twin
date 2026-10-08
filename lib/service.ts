import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { patients } from '@/data/patients';
import { analyze, validateReview, validateSources } from './evidence';
import { aiConfigured } from './ai';
import { sourceSchema, reviewSchema, approvalSchema, type Workspace } from './types';
import { startWorkflow, resumeWorkflow, sourceFingerprint } from './workflow';
import { answerQuestion } from './questions';
import { storageMode } from './store';

export const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('review'),
    revision: z.number().int().nonnegative(),
    data: reviewSchema,
  }),
  z.object({
    type: z.literal('run'),
    revision: z.number().int().nonnegative(),
    patientId: z.string().max(80),
  }),
  z.object({
    type: z.literal('approve'),
    revision: z.number().int().nonnegative(),
    runId: z.string().uuid(),
    approval: approvalSchema,
  }),
  z.object({
    type: z.literal('question'),
    revision: z.number().int().nonnegative(),
    patientId: z.string().max(80),
    question: z.string().trim().min(3).max(700),
  }),
  z.object({
    type: z.literal('import'),
    revision: z.number().int().nonnegative(),
    patientId: z.string().max(80),
    record: sourceSchema,
  }),
]);
export function runtimeInfo() {
  return {
    storage: storageMode(),
    ai: aiConfigured(),
    model: aiConfigured() ? process.env.AI_MODEL! : null,
    mcp: !!process.env.MCP_ACCESS_TOKEN,
    checkpoint: process.env.DATABASE_URL
      ? 'Persistent PostgreSQL checkpoints'
      : 'Memory checkpoints — local restart clears active runs',
  };
}
export async function executeAction(
  workspace: Workspace,
  sessionId: string,
  action: z.infer<typeof actionSchema>,
) {
  const now = new Date().toISOString();
  const audit = (patientId: string, title: string, detail: string, actor = 'Demo reviewer') =>
    workspace.audit.push({ id: randomUUID(), patientId, action: title, detail, actor, at: now });
  const getPatient = (id: string) => {
    const patient = patients.find((p) => p.id === id);
    if (!patient) throw new Error('Patient not found.');
    return patient;
  };
  // A bounded workspace keeps this demo inexpensive and prevents unlimited per-session model calls.
  if (workspace.audit.length > 500)
    throw new Error('This demo workspace reached its activity limit. Export your review notes.');
  if (action.type === 'review') {
    const patient = getPatient(action.data.patientId);
    const analysis = analyze(workspace.sources, patient, workspace.decisions);
    const issue = analysis.issues.find((i) => i.id === action.data.issueId);
    if (!issue) throw new Error('This issue no longer matches the available sources.');
    validateReview(issue, action.data.outcome, action.data.selectedClaimId);
    workspace.decisions.push({
      ...action.data,
      id: randomUUID(),
      createdAt: now,
      sourceIds: [...new Set(issue.evidence.map((e) => e.sourceId))],
    });
    audit(patient.id, 'Review decision saved', action.data.note, action.data.reviewer);
    return {
      message:
        action.data.outcome === 'keep_open'
          ? 'Note saved. This item remains open.'
          : 'Decision saved with its source history.',
    };
  }
  if (action.type === 'import') {
    const patient = getPatient(action.patientId);
    if (action.record.patientId !== patient.id)
      throw new Error('The record patient ID does not match this case.');
    if (workspace.sources.length >= 60) throw new Error('This demo supports up to 60 records.');
    if (workspace.sources.some((s) => s.id === action.record.id))
      throw new Error('This record ID already exists. Original records cannot be overwritten.');
    const proposed = [
      ...workspace.sources.filter((s) => s.patientId === patient.id),
      action.record,
    ];
    validateSources(proposed, patient.id);
    workspace.sources.push(action.record);
    audit(
      patient.id,
      'Record added',
      `${action.record.title} (${action.record.id}). Previous source text was preserved.`,
    );
    return { message: 'Record added. Evidence checks now include the new source.' };
  }
  if (action.type === 'run') {
    const patient = getPatient(action.patientId);
    const sources = workspace.sources.filter((s) => s.patientId === patient.id);
    const fingerprint = sourceFingerprint(sources);
    const recent = workspace.runs.find(
      (r) => r.patientId === patient.id && r.status === 'waiting' && r.fingerprint === fingerprint,
    );
    if (recent && process.env.DATABASE_URL)
      return { message: 'A review is already waiting for this record set.', runId: recent.id };
    const id = randomUUID();
    const threadId = `${sessionId}:${patient.id}:${id}`;
    const state = await startWorkflow(patient.id, sources, threadId);
    workspace.runs.push({
      id,
      patientId: patient.id,
      threadId,
      startedAt: now,
      status: 'waiting',
      events: state.events,
      sourceIds: sources.map((s) => s.id),
      fingerprint,
      brief: state.brief,
    });
    audit(
      patient.id,
      'Evidence workflow paused for review',
      `${sources.length} records processed. No clinical actions were taken.`,
    );
    return {
      message: 'Evidence checks complete. The workflow is waiting for your review.',
      runId: id,
    };
  }
  if (action.type === 'approve') {
    const run = workspace.runs.find((r) => r.id === action.runId);
    if (!run || !run.threadId.startsWith(`${sessionId}:`))
      throw new Error('Workflow not found in this workspace.');
    if (run.status !== 'waiting') throw new Error('This workflow has already been reviewed.');
    if (
      run.fingerprint !==
      sourceFingerprint(workspace.sources.filter((s) => s.patientId === run.patientId))
    )
      throw new Error(
        'New records were added after this run. Start a new evidence review before approving.',
      );
    const state = await resumeWorkflow(run.threadId, action.approval);
    run.status = 'completed';
    run.events = state.events;
    run.completedAt = now;
    run.reviewerNote = action.approval.note;
    audit(
      run.patientId,
      'Workflow review completed',
      action.approval.note,
      action.approval.reviewer,
    );
    return { message: 'Workflow review saved. Open evidence issues keep their own status.' };
  }
  const patient = getPatient(action.patientId);
  const recent = Object.values(workspace.answers)
    .flat()
    .filter((a) => Date.now() - new Date(a.createdAt).valueOf() < 300000);
  if (recent.length >= 10)
    throw new Error('Please wait a few minutes before asking another question.');
  const result = await answerQuestion(
    action.question,
    analyze(workspace.sources, patient, workspace.decisions).evidence,
    patient.id,
  );
  workspace.answers[patient.id] = [...(workspace.answers[patient.id] ?? []), result].slice(-30);
  audit(patient.id, 'Evidence question answered', result.mode);
  return { message: 'Answer ready.', answerId: result.id };
}
