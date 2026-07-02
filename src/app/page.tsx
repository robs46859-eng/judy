import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Dashboard from '@/components/Dashboard';

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main>
      <Dashboard
        userName={session.user.name ?? 'Traveler'}
        userEmail={session.user.email ?? ''}
      />
    </main>
  );
}
