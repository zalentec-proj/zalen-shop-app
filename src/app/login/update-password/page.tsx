import type { Metadata } from 'next';
import { platformBrand } from '@/lib/branding/platform-brand';
import { getCurrentUser } from '@/modules/auth/auth.service';
import UpdatePasswordClient from './UpdatePasswordClient';

export const metadata: Metadata = {
  title: `Definir nova senha — ${platformBrand.name}`,
};

export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();

  return <UpdatePasswordClient canUpdate={Boolean(user)} email={user?.email} />;
}
