import { AuthForm } from '../components/account-ui';
import { accountsConfigured, emailConfigured } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default function SignIn() {
  return <AuthForm mode="sign-in" ready={accountsConfigured()} emailEnabled={emailConfigured()} />;
}
