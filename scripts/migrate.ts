import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS cet_workspaces (id UUID PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS cet_workspaces_updated_idx ON cet_workspaces(updated_at);`,
  );
  const saver = new PostgresSaver(pool);
  await saver.setup();
  console.log('Workspace tables and LangGraph checkpoints are ready.');
} finally {
  await pool.end();
}
