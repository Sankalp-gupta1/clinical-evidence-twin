import type { Analysis, Decision, Evidence, Issue, Memory, Patient, Source } from './types';
import { sourceSchema } from './types';

export function normalizeValue(value: string | number, unit?: string) {
  if (typeof value !== 'number') return { value, unit };
  const conversions: Record<string, { factor: number; unit: string }> = {
    g: { factor: 0.001, unit: 'kg' },
    m: { factor: 100, unit: 'cm' },
  };
  const rule = unit ? conversions[unit] : undefined;
  if (!rule) return { value, unit };
  return {
    value: Number((value * rule.factor).toPrecision(12)),
    unit: rule.unit,
    conversion: `${value} ${unit} = ${Number((value * rule.factor).toPrecision(12))} ${rule.unit}`,
  };
}
export function validateSources(sources: Source[], patientId: string) {
  const recordIds = new Set<string>();
  const claimIds = new Set<string>();
  for (const raw of sources) {
    const source = sourceSchema.parse(raw);
    if (source.patientId !== patientId)
      throw new Error('Patient identifiers do not match. This record must be reviewed separately.');
    if (recordIds.has(source.id)) throw new Error('Duplicate record ID.');
    recordIds.add(source.id);
    for (const claim of source.claims) {
      if (claimIds.has(claim.id)) throw new Error('Duplicate claim ID.');
      claimIds.add(claim.id);
    }
  }
}
export function normalizeSources(sources: Source[]): Evidence[] {
  return sources.flatMap((source) =>
    source.claims.map((claim) => {
      const normalized = normalizeValue(claim.value, claim.unit);
      return {
        ...claim,
        sourceId: source.id,
        sourceTitle: source.title,
        organization: source.organization,
        recordedAt: source.recordedAt,
        normalizedValue: normalized.value,
        normalizedUnit: normalized.unit,
        conversion: normalized.conversion,
      };
    }),
  );
}
function comparable(fact: Evidence) {
  return `${typeof fact.normalizedValue === 'string' ? fact.normalizedValue.trim().toLowerCase() : fact.normalizedValue}|${fact.normalizedUnit ?? ''}`;
}
function stableId(text: string) {
  // A deterministic 64-bit hash avoids truncated IDs colliding across review groups.
  let hash = 14695981039346656037n;
  for (const char of text) {
    hash ^= BigInt(char.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, '0');
}
export function conflictIssues(evidence: Evidence[], patientId: string): Issue[] {
  const groups = new Map<string, Evidence[]>();
  for (const fact of evidence) {
    const key = `${fact.key}::${fact.context}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  return [...groups.entries()]
    .filter(([, group]) => new Set(group.map(comparable)).size > 1)
    .map(([key, group]) => ({
      id: `conflict-${stableId(
        `${patientId}:${key}:${group
          .map((g) => g.id)
          .sort()
          .join('|')}`,
      )}`,
      patientId,
      type: 'conflict',
      key,
      title:
        group[0].kind === 'medication'
          ? `${group[0].label}: two different instructions`
          : `${group[0].label}: records disagree`,
      detail: `${new Set(group.map((g) => g.sourceId)).size} records describe the same context differently. The newer record is not assumed to be correct.`,
      priority: group.some((g) => g.kind === 'medication' || g.key.startsWith('allergy'))
        ? 'Review first'
        : 'Check next',
      evidence: group,
      status: 'open',
    }));
}
export function missingIssues(evidence: Evidence[], patient: Patient): Issue[] {
  return patient.required
    .filter((required) => !evidence.some((f) => f.key === required.key))
    .map((required) => ({
      id: `missing-${patient.id}-${required.key.replaceAll('.', '-')}`,
      patientId: patient.id,
      type: 'missing',
      title: required.title,
      detail: required.detail,
      key: required.key,
      priority: 'Check next',
      evidence: [],
      status: 'open',
    }));
}
export function timelineFor(evidence: Evidence[]) {
  const groups = new Map<string, Evidence[]>();
  evidence.forEach((fact) =>
    groups.set(fact.effectiveAt, [...(groups.get(fact.effectiveAt) ?? []), fact]),
  );
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, claims]) => ({
      date,
      claims,
      sourceIds: [...new Set(claims.map((c) => c.sourceId))],
    }));
}
export function analyze(sources: Source[], patient: Patient, decisions: Decision[] = []): Analysis {
  const records = sources.filter((s) => s.patientId === patient.id);
  validateSources(records, patient.id);
  const evidence = normalizeSources(records);
  const issues = [...conflictIssues(evidence, patient.id), ...missingIssues(evidence, patient)].map(
    (issue) => {
      const latest = decisions
        .filter((d) => d.issueId === issue.id && d.patientId === patient.id)
        .at(-1);
      return {
        ...issue,
        status:
          latest && latest.outcome !== 'keep_open' ? ('reviewed' as const) : ('open' as const),
      };
    },
  );
  const memory: Memory[] = evidence.map((fact) => {
    const issue = issues.find((i) => i.evidence.some((e) => e.id === fact.id));
    const decision = issue
      ? decisions.filter((d) => d.issueId === issue.id && d.patientId === patient.id).at(-1)
      : undefined;
    return {
      id: fact.id,
      key: fact.key,
      label: fact.label,
      value: `${fact.normalizedValue}${fact.normalizedUnit ? ` ${fact.normalizedUnit}` : ''}`,
      effectiveAt: fact.effectiveAt,
      validUntil: fact.validUntil,
      status:
        decision?.outcome === 'use_source' && decision.selectedClaimId === fact.id
          ? 'Reviewer selected'
          : issue
            ? 'Needs review'
            : 'Source recorded',
      sourceIds: [fact.sourceId],
      claimIds: [fact.id],
      decisionId: decision?.id,
    };
  });
  return {
    evidence,
    issues,
    memory,
    timeline: timelineFor(evidence),
    conversions: evidence.filter((f) => f.conversion),
  };
}
export function searchEvidence(evidence: Evidence[], question: string, limit = 8): Evidence[] {
  const ignored = new Set([
    'what',
    'which',
    'when',
    'where',
    'the',
    'does',
    'have',
    'about',
    'show',
    'with',
    'from',
    'that',
    'this',
    'patient',
    'please',
    'records',
    'record',
  ]);
  const tokens =
    question
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((t) => t.length > 2 && !ignored.has(t)) ?? [];
  if (!tokens.length) return [];
  const scored = evidence.map((f) => {
    const haystack = `${f.label} ${f.key} ${f.value} ${f.context} ${f.excerpt}`.toLowerCase();
    return { fact: f, score: tokens.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0) };
  });
  return scored
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || b.fact.effectiveAt.localeCompare(a.fact.effectiveAt))
    .slice(0, limit)
    .map((f) => f.fact);
}
export function validateReview(issue: Issue, outcome: string, selectedClaimId?: string) {
  if (
    outcome === 'use_source' &&
    (!selectedClaimId || !issue.evidence.some((e) => e.id === selectedClaimId))
  )
    throw new Error('Choose one of this issue’s cited statements.');
  if (issue.type === 'missing' && outcome === 'use_source')
    throw new Error('Missing information has no source to select.');
}
