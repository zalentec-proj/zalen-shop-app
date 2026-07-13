import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  canAccessStore,
  checkStoreRole,
  getCurrentUser,
} from '@/modules/auth/auth.service';
import { sendOrderToBling } from '@/modules/integrations/bling/orders/bling-order-send.service';
import { parseOrderReference } from '@/modules/orders/order-reference';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const homologationConfirmation = 'HOMOLOGAR NO BLING';

function getOrderRequest(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const orderId = record.orderId;

  if (typeof orderId !== 'string' || !orderId.trim()) {
    return undefined;
  }

  const orderReference = parseOrderReference(orderId);

  if (!orderReference) {
    return { invalidOrderReference: true as const };
  }

  return {
    orderId: orderReference.value,
    invalidOrderReference: false as const,
    isHomologation: record.mode === 'homologation',
    hasHomologationConfirmation:
      record.confirmation === homologationConfirmation,
  };
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

  const orderRequest = getOrderRequest(body);

  if (!orderRequest) {
    return NextResponse.json(
      { status: 'error', errorCode: 'missing_order_id' },
      { status: 400 }
    );
  }

  if (orderRequest.invalidOrderReference) {
    return NextResponse.json(
      { status: 'error', errorCode: 'invalid_order_reference' },
      { status: 400 }
    );
  }

  if (orderRequest.isHomologation) {
    const role = await checkStoreRole(store.id, ['store_owner', 'store_admin']);

    if (!role.allowed) {
      return NextResponse.json(
        { status: 'error', errorCode: 'homologation_access_denied' },
        { status: 403 }
      );
    }

    if (!orderRequest.hasHomologationConfirmation) {
      return NextResponse.json(
        { status: 'error', errorCode: 'homologation_confirmation_required' },
        { status: 400 }
      );
    }
  }

  const result = await sendOrderToBling({
    storeId: store.id,
    orderId: orderRequest.orderId,
    trigger: orderRequest.isHomologation ? 'admin_test' : 'admin_retry',
  });

  revalidatePath('/admin');
  revalidatePath('/admin/integracoes/bling');

  return NextResponse.json(result, {
    status: result.status === 'error' ? 400 : 200,
  });
}
