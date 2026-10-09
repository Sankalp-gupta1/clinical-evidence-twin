import { getMigrations } from 'better-auth/db/migration';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { getAuth, accountsConfigured } from '../lib/auth';
import { getPool } from '../lib/store';
import { hospitalSchema } from '../lib/schema';

async function main() {
  if (!accountsConfigured()) {
    if (process.argv.includes('--if-configured')) {
      console.log('Account setup is incomplete. Building the read-only demo and setup screens.');
      process.exit(0);
    }
    throw new Error('DATABASE_URL and BETTER_AUTH_SECRET (32+ characters) are required.');
  }
  const pool = getPool()!;
  const lock = await pool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(48219013)');
    const migration = await getMigrations(getAuth().options);
    await migration.runMigrations();
    await pool.query(hospitalSchema);
    await new PostgresSaver(pool).setup();
    console.log('Accounts, hospital access, source storage and workflow checkpoints are ready.');
  } finally {
    await lock.query('SELECT pg_advisory_unlock(48219013)');
    lock.release();
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    'Database preparation failed. Check the private provider logs and migration configuration.',
  );
  process.exitCode = 1;
});
