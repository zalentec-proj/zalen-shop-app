import { NextResponse } from 'next/server';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { runBlingHomologation } from '@/modules/integrations/bling/homologation/bling-homologation.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const store = await resolveCurrentStoreFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { status: 'error', errorCode: 'missing_session' },
      { status: 401 }
    );
  }

  if (!(await canAccessStore(user.id, store.id))) {
    return NextResponse.json(
      { status: 'error', errorCode: 'access_denied' },
      { status: 403 }
    );
  }

  const result = await runBlingHomologation(store.id);

  return NextResponse.json(result, {
    status: result.status === 'success' ? 200 : 400,
  });
}
