import HospitalHub from '../components/hospital-hub';
import { accountsConfigured } from '@/lib/auth';
import { signedInUser } from '@/lib/hospitals';
import { AccessError } from '@/lib/permissions';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function HospitalPage() {
  if (!accountsConfigured()) return <HospitalHub setup />;
  try {
    await signedInUser();
  } catch (e) {
    if (e instanceof AccessError) redirect('/sign-in');
    throw e;
  }
  return <HospitalHub />;
}
