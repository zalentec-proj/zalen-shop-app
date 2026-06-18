import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { sendOrderToBling } from '@/modules/integrations/bling/orders/bling-order-send.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';

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
    storeId: ACTIVE_STORE_ID,
    orderId,
    trigger: 'admin_retry',
  });

  revalidatePath('/admin');

  return NextResponse.json(result, {
    status: result.status === 'error' ? 400 : 200,
  });
}
