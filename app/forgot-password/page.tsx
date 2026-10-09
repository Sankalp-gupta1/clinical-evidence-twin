import { AuthForm } from '../components/account-ui';
import { accountsConfigured, emailConfigured } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default function Forgot() {
  return <AuthForm mode="reset" ready={accountsConfigured()} emailEnabled={emailConfigured()} />;
}
