import { NextResponse } from 'next/server';
import { workspaceSession } from '@/lib/session';
import { readWorkspace } from '@/lib/store';
import { patients } from '@/data/patients';
import { runtimeInfo } from '@/lib/service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const id = await workspaceSession();
    return NextResponse.json(
      { workspace: await readWorkspace(id), patients, runtime: runtimeInfo() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'The saved workspace could not be loaded. Please try again.' },
      { status: 503 },
    );
  }
}
