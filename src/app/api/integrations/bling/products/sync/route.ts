import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { runBlingProductSync } from '@/modules/integrations/bling/products/bling-product-sync.service';

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

  const result = await runBlingProductSync(ACTIVE_STORE_ID);

  if (result.status === 'success') {
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/categoria/[slug]', 'page');
    revalidatePath('/produto/[slug]', 'page');
  }

  return NextResponse.json(result, {
    status: result.status === 'success' ? 200 : 400,
  });
}
