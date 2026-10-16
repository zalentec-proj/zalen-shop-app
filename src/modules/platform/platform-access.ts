import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, getPlatformRole } from '@/modules/auth/auth.service';

export const requirePlatformAccess = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/platform/lojas');
  const role = await getPlatformRole(user.id);
  if (!role) redirect('/lojas?acesso=restrito');
  return { user, role };
});
