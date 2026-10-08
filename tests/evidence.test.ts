import test from 'node:test';
import assert from 'node:assert/strict';
import { patients, seedWorkspace } from '../data/patients';
import {
  analyze,
  conflictIssues,
  normalizeValue,
  normalizeSources,
  validateSources,
  validateReview,
  searchEvidence,
} from '../lib/evidence';
import { dateSchema, sourceSchema } from '../lib/types';
import { answerQuestion } from '../lib/questions';
const mira = patients[0];

test('Mira has three contradictory contexts and one missing follow-up; every citation is real', () => {
  const ws = seedWorkspace();
  const analysis = analyze(ws.sources, mira);
  assert.equal(analysis.issues.filter((i) => i.type === 'conflict').length, 3);
  assert.equal(analysis.issues.filter((i) => i.type === 'missing').length, 1);
  for (const fact of analysis.evidence) {
    const source = ws.sources.find((s) => s.id === fact.sourceId)!;
    assert.equal(source.patientId, mira.id);
    assert.ok(source.text.includes(fact.excerpt));
  }
});
test('equivalent units are normalized without false contradictions or loss of originals', () => {
  const ws = seedWorkspace();
  const analysis = analyze(ws.sources, patients[2]);
  assert.equal(analysis.issues.filter((i) => i.type === 'conflict').length, 0);
  assert.equal(analysis.conversions.length, 2);
  assert.equal(ws.sources.find((s) => s.id === 'LR-02')!.claims[0].value, 62000);
  assert.deepEqual(normalizeValue(74000, 'g'), {
    value: 74,
    unit: 'kg',
    conversion: '74000 g = 74 kg',
  });
  assert.deepEqual(normalizeValue(1.68, 'm'), {
    value: 168,
    unit: 'cm',
    conversion: '1.68 m = 168 cm',
  });
  assert.deepEqual(normalizeValue(4.2, 'unsupported'), { value: 4.2, unit: 'unsupported' });
});
test('patient data never joins by similar name or crosses a patient boundary', () => {
  const ws = seedWorkspace();
  assert.throws(() => validateSources(ws.sources, 'demo-mira'), /identifiers do not match/);
  const evidence = analyze(ws.sources, patients[1]).evidence;
  assert.ok(evidence.every((e) => e.sourceId.startsWith('AM-')));
});
test('quotes, claim IDs, record IDs and calendar dates are validated', () => {
  const record = structuredClone(seedWorkspace().sources[0]);
  record.claims[0].excerpt = 'invented evidence';
  assert.equal(sourceSchema.safeParse(record).success, false);
  const original = seedWorkspace().sources[0];
  assert.throws(() => validateSources([original, original], mira.id), /Duplicate record/);
  const duplicate = { ...structuredClone(original), id: 'different-source' };
  assert.throws(() => validateSources([original, duplicate], mira.id), /Duplicate claim/);
  assert.equal(dateSchema.safeParse('2026-02-30').success, false);
  assert.equal(dateSchema.safeParse('2026-02-28').success, true);
});
test('different measurements at different visits are not automatically contradictions', () => {
  const evidence = normalizeSources(seedWorkspace().sources.filter((s) => s.patientId === mira.id));
  const weights = evidence.filter((f) => f.key === 'weight');
  weights[1].normalizedValue = 76;
  assert.equal(conflictIssues(weights, mira.id).length, 0);
});
test('review choices must point to an actual cited statement; both originals stay', () => {
  const ws = seedWorkspace();
  const analysis = analyze(ws.sources, mira);
  const issue = analysis.issues.find((i) => i.type === 'conflict')!;
  assert.throws(() => validateReview(issue, 'use_source', 'not-a-claim'), /Choose/);
  assert.doesNotThrow(() => validateReview(issue, 'use_source', issue.evidence[0].id));
  ws.decisions.push({
    id: 'review-1',
    issueId: issue.id,
    patientId: mira.id,
    outcome: 'use_source',
    selectedClaimId: issue.evidence[0].id,
    note: 'I checked the original statement in this synthetic record.',
    reviewer: 'Test reviewer',
    createdAt: new Date().toISOString(),
    sourceIds: issue.evidence.map((e) => e.sourceId),
  });
  const next = analyze(ws.sources, mira, ws.decisions);
  assert.equal(next.issues.find((i) => i.id === issue.id)!.status, 'reviewed');
  assert.equal(next.memory.find((m) => m.id === issue.evidence[0].id)!.status, 'Reviewer selected');
  assert.equal(next.evidence.length, analysis.evidence.length);
});
test('keep-open notes never silently resolve a disagreement', () => {
  const ws = seedWorkspace();
  const issue = analyze(ws.sources, mira).issues[0];
  ws.decisions.push({
    id: 'n',
    issueId: issue.id,
    patientId: mira.id,
    outcome: 'keep_open',
    note: 'Need the signed source before proceeding.',
    reviewer: 'Test reviewer',
    createdAt: new Date().toISOString(),
    sourceIds: [],
  });
  assert.equal(analyze(ws.sources, mira, ws.decisions).issues[0].status, 'open');
});
test('questions about disagreement include every competing side and no other patient', async () => {
  const evidence = analyze(seedWorkspace().sources, mira).evidence;
  const answer = await answerQuestion('Which records disagree?', evidence, mira.id);
  assert.equal(answer.mode, 'Evidence search');
  for (const id of ['MS-01', 'MS-02', 'MS-03', 'MS-04', 'MS-05'])
    assert.ok(answer.sourceIds.includes(id));
  assert.ok(!answer.sourceIds.some((id) => id.startsWith('AM-')));
});
test('unanswerable and treatment questions do not invent an answer', async () => {
  const evidence = analyze(seedWorkspace().sources, mira).evidence;
  const missing = await answerQuestion('What is the oxygen saturation?', evidence, mira.id);
  assert.equal(missing.sourceIds.length, 0);
  assert.match(missing.answer, /could not find/);
  const blocked = await answerQuestion('Should I stop taking medication?', evidence, mira.id);
  assert.match(blocked.answer, /cannot diagnose/);
  assert.equal(blocked.sourceIds.length, 0);
});
test('search returns exact provenance and stable deterministic analysis', () => {
  const ws = seedWorkspace();
  const before = JSON.stringify(ws);
  const a = analyze(ws.sources, mira);
  assert.ok(searchEvidence(a.evidence, 'weight').every((f) => f.key === 'weight'));
  assert.deepEqual(analyze(ws.sources, mira), a);
  assert.equal(JSON.stringify(ws), before);
});
