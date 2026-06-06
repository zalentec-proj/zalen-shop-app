import { NextResponse } from 'next/server';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { runBlingHomologation } from '@/modules/integrations/bling/homologation/bling-homologation.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { status: 'error', errorCode: 'missing_session' },
      { status: 401 }
    );
  }

  if (!(await canAccessStore(user.id, ACTIVE_STORE_ID))) {
    return NextResponse.json(
      { status: 'error', errorCode: 'access_denied' },
      { status: 403 }
    );
  }

  const result = await runBlingHomologation(ACTIVE_STORE_ID);

  return NextResponse.json(result, {
    status: result.status === 'success' ? 200 : 400,
  });
}
