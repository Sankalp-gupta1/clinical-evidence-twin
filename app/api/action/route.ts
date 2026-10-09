import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { signedInUser, withHospital } from '@/lib/hospitals';
import { AccessError } from '@/lib/permissions';
import { verifyOrigin } from '@/lib/session';
import { ConflictError, mutateWorkspace, UnavailableError } from '@/lib/store';
import { actionSchema, executeAction, runtimeInfo } from '@/lib/service';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    if (Number(request.headers.get('content-length') ?? 0) > 100000)
      return NextResponse.json({ error: 'This record is too large.' }, { status: 413 });
    const text = await request.text();
    if (text.length > 100000)
      return NextResponse.json({ error: 'This record is too large.' }, { status: 413 });
    const body = JSON.parse(text);
    const action = actionSchema.parse(body);
    const user = await signedInUser(request.headers);
    const updated = await withHospital(user, body.hospitalId, 'review', async (db, hospital) =>
      mutateWorkspace(
        hospital.id,
        action.revision,
        (ws) => executeAction(ws, hospital.id, action, user),
        db,
      ),
    );
    return NextResponse.json(
      { ...updated, runtime: runtimeInfo() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof AccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((i) => i.message)
            .slice(0, 3)
            .join(' '),
        },
        { status: 400 },
      );
    if (error instanceof ConflictError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof UnavailableError)
      return NextResponse.json({ error: error.message }, { status: 503 });
    // Do not forward provider/database errors, which can contain operational details.
    const safe =
      error instanceof Error &&
      /^(Patient|This |Choose |The record|The end|Duplicate|Missing|Unknown|New records|A |Record|Please wait|Cross-site|Workflow)/.test(
        error.message,
      );
    return NextResponse.json(
      {
        error: safe
          ? (error as Error).message
          : 'The action could not be completed. Your original records were not changed.',
      },
      { status: 400 },
    );
  }
}
