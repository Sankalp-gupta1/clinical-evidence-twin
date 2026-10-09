import { z } from 'zod';
import { patients, seedWorkspace } from '@/data/patients';
import { analyze } from '@/lib/evidence';
import { answerQuestion } from '@/lib/questions';
import { verifyOrigin } from '@/lib/session';
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const raw = await request.text();
    if (raw.length > 2000)
      return Response.json({ error: 'Please keep your question short.' }, { status: 413 });
    const input = z
      .object({ question: z.string().trim().min(3).max(700), patientId: z.string().max(80) })
      .parse(JSON.parse(raw));
    const patient = patients.find((p) => p.id === input.patientId);
    if (!patient) return Response.json({ error: 'Patient not found.' }, { status: 404 });
    // Public questions can only read the fixed seed data, never hospital data or a paid model.
    const answer = await answerQuestion(
      input.question,
      analyze(seedWorkspace().sources, patient).evidence,
      patient.id,
      false,
    );
    return Response.json({ answer }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { error: 'The question could not be answered. Please try again.' },
      { status: 400 },
    );
  }
}
