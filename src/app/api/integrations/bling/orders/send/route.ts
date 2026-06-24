import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { sendOrderToBling } from '@/modules/integrations/bling/orders/bling-order-send.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOrderId(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const orderId = (body as Record<string, unknown>).orderId;
  return typeof orderId === 'string' && orderId.trim() ? orderId.trim() : undefined;
}

export async function POST(request: NextRequest) {
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  const orderId = getOrderId(body);

  if (!orderId) {
    return NextResponse.json(
      { status: 'error', errorCode: 'missing_order_id' },
      { status: 400 }
    );
  }

  const result = await sendOrderToBling({
    storeId: store.id,
    orderId,
    trigger: 'admin_retry',
  });

  revalidatePath('/admin');
  revalidatePath('/admin/integracoes/bling');

  return NextResponse.json(result, {
    status: result.status === 'error' ? 400 : 200,
  });
}
