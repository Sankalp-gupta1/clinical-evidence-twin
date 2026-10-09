import { AuthForm } from '../components/account-ui';
import { accountsConfigured, emailConfigured } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default function SignUp() {
  return <AuthForm mode="sign-up" ready={accountsConfigured()} emailEnabled={emailConfigured()} />;
}
