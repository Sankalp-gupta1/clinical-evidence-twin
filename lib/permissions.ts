export type HospitalRole = 'owner' | 'reviewer' | 'viewer';
export type HospitalPermission = 'read' | 'review' | 'manage';
export class AccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}
export function requirePermission(role: string | undefined, permission: HospitalPermission) {
  const allowed =
    permission === 'manage'
      ? ['owner']
      : permission === 'review'
        ? ['owner', 'reviewer']
        : ['owner', 'reviewer', 'viewer'];
  if (!role || !allowed.includes(role))
    throw new AccessError(
      permission === 'manage'
        ? 'Only the hospital owner can manage access.'
        : permission === 'review'
          ? 'Your role can view records. Ask the owner for reviewer access to save changes.'
          : 'You do not have access to this hospital.',
    );
}
export type AccountUser = { id: string; name: string; email: string; emailVerified: boolean };
export type HospitalSummary = {
  id: string;
  name: string;
  department: string;
  role: HospitalRole;
  createdAt: string;
};
export type HospitalContext = { user: AccountUser; hospital: HospitalSummary };
export type AccountResponse = {
  configured: boolean;
  emailEnabled: boolean;
  user: AccountUser | null;
  hospitals: HospitalSummary[];
  requests: { id: string; hospitalName: string; status: string; createdAt: string }[];
};
