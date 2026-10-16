import type { Metadata } from 'next';
import { OperationalShell } from '@/components/platform/OperationalShell';
import { requirePlatformAccess } from '@/modules/platform/platform-access';
import { noindexMetadata } from '@/modules/seo/seo.service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Plataforma — Zalen Shop', ...noindexMetadata };

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requirePlatformAccess();
  return (
    <OperationalShell email={user.email} platform roleLabel={role === 'platform_owner' ? 'Dono da plataforma' : 'Admin da plataforma'}>
      {children}
    </OperationalShell>
  );
}
