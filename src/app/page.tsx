import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Dashboard from '@/components/Dashboard';
import { isAvatarAdminEmail } from '@/lib/avatar/adminAccess';
import { getCurrentAvatar } from '@/lib/avatar/avatarStorage';

const BUNDLED_AVATAR_MODEL_URL = '/Judynoplip.glb';

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let avatarModelUrl = BUNDLED_AVATAR_MODEL_URL;
  try {
    const currentAvatar = await getCurrentAvatar();
    if (currentAvatar) avatarModelUrl = currentAvatar.modelUrl;
  } catch {
    // A missing/corrupt runtime upload must never prevent Judy from loading.
  }

  return (
    <main>
      <Dashboard
        userName={session.user.name ?? 'Traveler'}
        userEmail={session.user.email ?? ''}
        avatarModelUrl={avatarModelUrl}
        avatarAdmin={isAvatarAdminEmail(session.user.email)}
      />
    </main>
  );
}
