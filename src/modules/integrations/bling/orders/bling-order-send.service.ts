import 'server-only';

import {
  getOrderByIdFromRepository,
  updateOrderExternalErpStateInRepository,
} from '@/modules/orders/order.repository';
import { BLING_PROVIDER_KEY } from '../bling.config';
import { BlingApiClientError, createBlingApiClientForStore } from '../bling.api-client';
import {
  completeBlingOrderSendJobInRepository,
  createBlingOrderSendJobInRepository,
  hasRunningBlingOrderSendJobInRepository,
} from '../bling.repository';
import {
  mapOrderToBlingDraft,
  summarizeBlingOrderDraft,
} from './bling-order.mapper';
import type { BlingOrderSendResult } from './bling-order.types';

type SendOrderInput = {
  storeId: string;
  orderId: string;
  trigger: 'checkout' | 'admin_retry';
};

function getSafeErrorCode(error: unknown) {
  if (error instanceof BlingApiClientError) {
    return error.code;
  }

  if (error instanceof Error && error.message === 'order_missing_customer_data') {
    return error.message;
  }

  if (
    error instanceof Error &&
    error.message === 'bling_order_contract_pending'
  ) {
    return error.message;
  }

  return 'bling_order_send_failed';
}

async function markOrderSendError(input: {
  storeId: string;
  orderId: string;
  errorCode: string;
}) {
  await updateOrderExternalErpStateInRepository({
    storeId: input.storeId,
    orderId: input.orderId,
    provider: BLING_PROVIDER_KEY,
    status: 'error',
    lastError: input.errorCode,
  });
}

export async function sendOrderToBling(
  input: SendOrderInput
): Promise<BlingOrderSendResult> {
  const order = await getOrderByIdFromRepository(input.storeId, input.orderId);

  if (!order) {
    return {
      status: 'error',
      orderId: input.orderId,
      errorCode: 'order_not_found',
    };
  }

  if (order.externalErpProvider === BLING_PROVIDER_KEY && order.externalErpId) {
    await updateOrderExternalErpStateInRepository({
      storeId: input.storeId,
      orderId: input.orderId,
      provider: BLING_PROVIDER_KEY,
      externalId: order.externalErpId,
      status: 'synced',
      syncedAt: order.externalErpSyncedAt ?? new Date().toISOString(),
    });

    return {
      status: 'skipped',
      orderId: order.id,
      orderNumber: order.orderNumber,
      externalId: order.externalErpId,
    };
  }

  if (
    await hasRunningBlingOrderSendJobInRepository({
      storeId: input.storeId,
      orderId: input.orderId,
    })
  ) {
    return {
      status: 'skipped',
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode: 'order_send_already_running',
    };
  }

  const jobId = await createBlingOrderSendJobInRepository({
    storeId: input.storeId,
    orderId: order.id,
    orderNumber: order.orderNumber,
  });
  const startedAt = new Date().toISOString();
  let draftSummary: Record<string, unknown> | undefined;

  try {
    const draft = mapOrderToBlingDraft(order);
    draftSummary = summarizeBlingOrderDraft(draft);

    if (
      !draft.customer.name ||
      !draft.customer.email ||
      !draft.customer.phone ||
      !draft.customer.document
    ) {
      throw new Error('order_missing_customer_data');
    }

    await createBlingApiClientForStore(input.storeId);

    // The official order creation endpoint/payload is still not documented in
    // docs/integrations/bling-research.md. Do not perform a real external POST
    // until that contract is confirmed from Bling official docs.
    throw new Error('bling_order_contract_pending');
  } catch (error) {
    const errorCode = getSafeErrorCode(error);

    await markOrderSendError({
      storeId: input.storeId,
      orderId: order.id,
      errorCode,
    });

    await completeBlingOrderSendJobInRepository({
      jobId,
      storeId: input.storeId,
      status: 'error',
      lastError: errorCode,
      summary: {
        ...(draftSummary ?? {}),
        orderId: order.id,
        orderNumber: order.orderNumber,
        trigger: input.trigger,
        status: 'error',
        errorCode,
        startedAt,
        processedAt: new Date().toISOString(),
      },
    });

    return {
      status: 'error',
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode,
    };
  }
}

export async function tryAutoSendOrderToBling(input: {
  storeId: string;
  orderId: string;
}) {
  try {
    return await sendOrderToBling({
      ...input,
      trigger: 'checkout',
    });
  } catch {
    return {
      status: 'error' as const,
      orderId: input.orderId,
      errorCode: 'bling_order_send_failed',
    };
  }
}
