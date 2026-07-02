import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AuthForm from '@/components/AuthForm';

export const metadata = {
  title: 'Sign in — Judy App',
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <main className="auth-page">
      <div className="bg-skyline" />
      <div className="bg-gradient-overlay" />
      <AuthForm />
    </main>
  );
}
