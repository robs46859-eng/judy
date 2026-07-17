import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import AvatarManager from '@/components/admin/AvatarManager';
import { isAvatarAdminEmail } from '@/lib/avatar/adminAccess';
import { auth } from '@/lib/auth';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function AvatarManagerPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!isAvatarAdminEmail(session.user.email)) notFound();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.backLink} href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Judy
        </Link>
        <AvatarManager />
      </div>
    </main>
  );
}
