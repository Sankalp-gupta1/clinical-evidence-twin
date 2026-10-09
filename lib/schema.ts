// Additive schema: existing source records and review history are never dropped.
export const hospitalSchema = `
CREATE TABLE IF NOT EXISTS cet_workspaces (
  id UUID PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cet_workspaces_updated_idx ON cet_workspaces(updated_at);
CREATE TABLE IF NOT EXISTS cet_hospitals (
  id UUID PRIMARY KEY, name TEXT NOT NULL, department TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cet_members (
  hospital_id UUID NOT NULL REFERENCES cet_hospitals(id),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  role TEXT NOT NULL CHECK(role IN ('owner','reviewer','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(hospital_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS cet_one_owner ON cet_members(hospital_id) WHERE role='owner';
CREATE INDEX IF NOT EXISTS cet_members_user_idx ON cet_members(user_id);
CREATE TABLE IF NOT EXISTS cet_join_requests (
  id UUID PRIMARY KEY, hospital_id UUID NOT NULL REFERENCES cet_hospitals(id),
  user_id TEXT NOT NULL REFERENCES "user"(id), note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(hospital_id,user_id)
);
CREATE TABLE IF NOT EXISTS cet_access_audit (
  id UUID PRIMARY KEY, hospital_id UUID NOT NULL REFERENCES cet_hospitals(id),
  actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cet_access_audit_hospital_idx ON cet_access_audit(hospital_id,created_at DESC);
CREATE TABLE IF NOT EXISTS cet_daily_usage (
  day DATE PRIMARY KEY, ai_requests INTEGER NOT NULL DEFAULT 0
);
`;
