import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import {
  checkStoreRole,
  storeOperationalRoles,
} from '@/modules/auth/auth.service';
import { processBlingWebhookJobs } from '@/modules/integrations/bling/webhooks/bling-webhook-processor.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const store = await resolveCurrentStoreFromRequest(request);
  const access = await checkStoreRole(store.id, storeOperationalRoles);

  if (!access.user) {
    return NextResponse.json(
      { status: 'error', errorCode: 'missing_session' },
      { status: 401 }
    );
  }

  if (!access.allowed) {
    return NextResponse.json(
      { status: 'error', errorCode: 'access_denied' },
      { status: 403 }
    );
  }

  const result = await processBlingWebhookJobs({
    storeId: store.id,
    limit: 20,
  });

  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/integracoes/bling');
  revalidatePath('/categoria/[slug]', 'page');
  revalidatePath('/produto/[slug]', 'page');

  return NextResponse.json(result);
}
