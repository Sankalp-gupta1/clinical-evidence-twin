import { NextResponse } from 'next/server';
import { getPool, storageMode } from '@/lib/store';
import { accountsConfigured, emailConfigured } from '@/lib/auth';
export async function GET() {
  try {
    const pool = getPool();
    if (accountsConfigured() && pool) {
      await pool.query('SELECT id FROM cet_hospitals LIMIT 1');
      await pool.query('SELECT id FROM "user" LIMIT 1');
    }
    return NextResponse.json(
      {
        status: 'ok',
        storage: storageMode(),
        accounts: accountsConfigured(),
        emailRecovery: emailConfigured(),
        syntheticOnly: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503 });
  }
}
