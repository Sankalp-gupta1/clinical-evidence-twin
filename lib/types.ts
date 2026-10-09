import { z } from 'zod';

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Use a real calendar date in YYYY-MM-DD format.');
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const claimSchema = z.object({
  id,
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(120),
  value: z.union([z.string().min(1).max(500), z.number().finite()]),
  unit: z.string().max(30).optional(),
  kind: z.enum(['fact', 'measurement', 'medication', 'event']),
  context: z.string().min(1).max(100),
  effectiveAt: dateSchema,
  validUntil: dateSchema.optional(),
  excerpt: z.string().min(1).max(1500),
});
export const sourceSchema = z
  .object({
    id,
    patientId: id,
    title: z.string().min(1).max(150),
    organization: z.string().min(1).max(120),
    recordedAt: dateSchema,
    type: z.enum(['Visit note', 'Lab report', 'Discharge note', 'Medication list', 'Referral']),
    text: z.string().min(1).max(24000),
    claims: z.array(claimSchema).max(50),
    synthetic: z.literal(true),
  })
  .superRefine((record, ctx) => {
    record.claims.forEach((claim, i) => {
      if (!record.text.includes(claim.excerpt))
        ctx.addIssue({
          code: 'custom',
          path: ['claims', i, 'excerpt'],
          message: 'The quoted evidence must appear exactly in the source text.',
        });
      if (claim.validUntil && claim.validUntil < claim.effectiveAt)
        ctx.addIssue({
          code: 'custom',
          path: ['claims', i, 'validUntil'],
          message: 'The end date cannot come before the start date.',
        });
    });
    if (new Set(record.claims.map((c) => c.id)).size !== record.claims.length)
      ctx.addIssue({
        code: 'custom',
        path: ['claims'],
        message: 'Claim IDs must be unique within a record.',
      });
  });
export type Source = z.infer<typeof sourceSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Evidence = Claim & {
  sourceId: string;
  sourceTitle: string;
  organization: string;
  recordedAt: string;
  normalizedValue: string | number;
  normalizedUnit?: string;
  conversion?: string;
};
export type Patient = {
  id: string;
  name: string;
  initials: string;
  age: number;
  subtitle: string;
  color: string;
  focus: string;
  required: { key: string; title: string; detail: string }[];
};
export type Issue = {
  id: string;
  patientId: string;
  type: 'conflict' | 'missing';
  title: string;
  detail: string;
  key: string;
  priority: 'Review first' | 'Check next';
  evidence: Evidence[];
  status: 'open' | 'reviewed';
};
export type Decision = {
  actorId?: string;
  id: string;
  issueId: string;
  patientId: string;
  outcome: 'keep_open' | 'use_source' | 'documented';
  note: string;
  selectedClaimId?: string;
  reviewer: string;
  createdAt: string;
  sourceIds: string[];
};
export type Memory = {
  id: string;
  key: string;
  label: string;
  value: string;
  effectiveAt: string;
  validUntil?: string;
  status: 'Source recorded' | 'Needs review' | 'Reviewer selected';
  sourceIds: string[];
  claimIds: string[];
  decisionId?: string;
};
export type RunEvent = { node: string; title: string; detail: string; at: string };
export type Run = {
  id: string;
  patientId: string;
  threadId: string;
  startedAt: string;
  completedAt?: string;
  status: 'waiting' | 'completed' | 'failed';
  events: RunEvent[];
  sourceIds: string[];
  fingerprint: string;
  brief: string;
  reviewerNote?: string;
  error?: string;
};
export type AuditEvent = {
  actorId?: string;
  id: string;
  patientId: string;
  action: string;
  detail: string;
  at: string;
  actor: string;
};
export type Answer = {
  id: string;
  question: string;
  answer: string;
  sourceIds: string[];
  mode: 'Evidence search' | 'AI summary';
  createdAt: string;
  warning?: string;
};
export type Workspace = {
  version: 1;
  revision: number;
  sources: Source[];
  decisions: Decision[];
  runs: Run[];
  audit: AuditEvent[];
  answers: Record<string, Answer[]>;
};
export type Analysis = {
  evidence: Evidence[];
  issues: Issue[];
  memory: Memory[];
  timeline: { date: string; sourceIds: string[]; claims: Evidence[] }[];
  conversions: Evidence[];
};
export type WorkspaceResponse = {
  access?: import('./permissions').HospitalContext;
  workspace: Workspace;
  patients: Patient[];
  runtime: {
    storage: 'PostgreSQL' | 'Local file' | 'Read-only preview';
    ai: boolean;
    model: string | null;
    mcp: boolean;
    checkpoint: string;
  };
};
export const reviewSchema = z.object({
  issueId: id,
  patientId: id,
  outcome: z.enum(['keep_open', 'use_source', 'documented']),
  note: z
    .string()
    .trim()
    .min(12, 'Please explain your decision in at least 12 characters.')
    .max(2000),
  selectedClaimId: id.optional(),
  reviewer: z.string().trim().min(2).max(80),
});
export const approvalSchema = z.object({
  approved: z.literal(true),
  note: z.string().trim().min(12).max(2000),
  reviewer: z.string().trim().min(2).max(80),
});
