import WorkspaceApp from '../components/workspace-app';
import { accountsConfigured } from '@/lib/auth';
import { signedInUser, withHospital } from '@/lib/hospitals';
import { AccessError } from '@/lib/permissions';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ hospital?: string }>;
}) {
  if (!accountsConfigured()) redirect('/hospital');
  const id = (await searchParams).hospital;
  if (!id) redirect('/hospital');
  let context;
  try {
    const user = await signedInUser();
    context = await withHospital(user, id, 'read', async (_db, hospital) => ({ user, hospital }));
  } catch (e) {
    if (e instanceof AccessError) redirect(e.status === 401 ? '/sign-in' : '/hospital');
    throw e;
  }
  return <WorkspaceApp context={context} />;
}
