import { NextResponse } from 'next/server';
import { getPool, storageMode } from '@/lib/store';
export async function GET() {
  try {
    const pool = getPool();
    if (pool) await pool.query('SELECT id FROM cet_workspaces LIMIT 1');
    return NextResponse.json({ status: 'ok', storage: storageMode(), syntheticOnly: true });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503 });
  }
}
