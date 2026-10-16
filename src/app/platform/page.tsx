import { redirect } from 'next/navigation';
import { requirePlatformAccess } from '@/modules/platform/platform-access';

export default async function PlatformPage() {
  await requirePlatformAccess();
  redirect('/platform/lojas');
}
