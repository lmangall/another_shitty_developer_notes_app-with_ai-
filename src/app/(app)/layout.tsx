import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Sidebar, MobileHeader } from '@/components/layout/sidebar';
import { QuickCreateFAB } from '@/components/quick-create-fab';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <MobileHeader />
      <Sidebar />
      <main className="flex-1 bg-background p-4 md:p-8 pt-16 md:pt-8">{children}</main>
      <QuickCreateFAB />
      {modal}
    </div>
  );
}
