import 'server-only';

import {
  getOrderByReferenceFromRepository,
  updateOrderExternalErpStateInRepository,
} from '@/modules/orders/order.repository';
import { BLING_PROVIDER_KEY } from '../bling.config';
import { BlingApiClientError, createBlingApiClientForStore } from '../bling.api-client';
import {
  completeBlingOrderSendJobInRepository,
  createBlingOrderSendJobInRepository,
  getBlingOrderSendSettingsFromRepository,
  hasRunningBlingOrderSendJobInRepository,
  recordBlingOrderSendEventInRepository,
} from '../bling.repository';
import {
  mapOrderToBlingDraft,
  summarizeBlingOrderDraft,
} from './bling-order.mapper';
import type {
  BlingCreateSalesOrderResponse,
  BlingOrderSendResult,
} from './bling-order.types';

type SendOrderInput = {
  storeId: string;
  orderId: string;
  trigger: 'checkout' | 'admin_retry' | 'admin_test';
};

function getSafeErrorCode(error: unknown) {
  if (error instanceof BlingApiClientError) {
    return error.status ? `${error.code}_${error.status}` : error.code;
  }

  if (error instanceof Error) {
    const safeErrorMessages = [
      'order_missing_customer_data',
      'order_missing_items',
      'bling_order_response_missing_id',
      'bling_order_send_disabled',
      'order_payment_not_approved',
    ];

    if (safeErrorMessages.includes(error.message)) {
      return error.message;
    }
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

function extractCreatedBlingOrderId(response: BlingCreateSalesOrderResponse) {
  const id = response.data?.id;

  if (typeof id === 'number' && Number.isFinite(id)) {
    return String(id);
  }

  if (typeof id === 'string' && id.trim()) {
    return id.trim();
  }

  return undefined;
}

function toDurationMs(startedAt: string) {
  return Date.now() - new Date(startedAt).getTime();
}

export async function sendOrderToBling(
  input: SendOrderInput
): Promise<BlingOrderSendResult> {
  const isHomologation = input.trigger === 'admin_test';
  const order = await getOrderByReferenceFromRepository(
    input.storeId,
    input.orderId
  );

  if (!order) {
    return {
      status: 'error',
      orderId: input.orderId,
      errorCode: 'order_not_found',
    };
  }

  if (order.paymentStatus !== 'paid') {
    await markOrderSendError({
      storeId: input.storeId,
      orderId: order.id,
      errorCode: 'order_payment_not_approved',
    });

    return {
      status: 'error',
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode: 'order_payment_not_approved',
    };
  }

  if (order.externalErpProvider === BLING_PROVIDER_KEY && order.externalErpId) {
    await updateOrderExternalErpStateInRepository({
      storeId: input.storeId,
      orderId: order.id,
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
      errorCode: 'order_already_synced',
    };
  }

  const orderSendSettings = await getBlingOrderSendSettingsFromRepository(
    input.storeId
  );

  if (!orderSendSettings.enabled && !isHomologation) {
    await updateOrderExternalErpStateInRepository({
      storeId: input.storeId,
      orderId: order.id,
      provider: BLING_PROVIDER_KEY,
      status: 'skipped',
      lastError: 'bling_order_send_disabled',
    });

    return {
      status: 'skipped',
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode: 'bling_order_send_disabled',
    };
  }

  if (
    await hasRunningBlingOrderSendJobInRepository({
      storeId: input.storeId,
      orderId: order.id,
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
    testMode: isHomologation,
  });
  const startedAt = new Date().toISOString();
  let draftSummary: Record<string, unknown> | undefined;

  try {
    const draft = mapOrderToBlingDraft(order, {
      paymentMethodId: orderSendSettings.paymentMethodId,
      isHomologation,
    });
    draftSummary = summarizeBlingOrderDraft(draft, { isHomologation });

    if (!draft.customer.name || !draft.customer.document) {
      throw new Error('order_missing_customer_data');
    }

    if (draft.items.length === 0 || draft.payload.itens.length === 0) {
      throw new Error('order_missing_items');
    }

    const { client, environment } = await createBlingApiClientForStore(
      input.storeId
    );
    const response = await client.request<BlingCreateSalesOrderResponse>(
      '/pedidos/vendas',
      {
        method: 'POST',
        body: draft.payload,
      }
    );
    const externalId = extractCreatedBlingOrderId(response);

    if (!externalId) {
      throw new Error('bling_order_response_missing_id');
    }

    const processedAt = new Date().toISOString();
    const summary = {
      jobId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      trigger: input.trigger,
      testMode: isHomologation,
      status: 'success',
      externalId,
      tokenRefreshed: client.hasRefreshedToken(),
      draft: draftSummary,
      startedAt,
      processedAt,
      durationMs: toDurationMs(startedAt),
    };

    await updateOrderExternalErpStateInRepository({
      storeId: input.storeId,
      orderId: order.id,
      provider: BLING_PROVIDER_KEY,
      externalId,
      status: 'synced',
      syncedAt: processedAt,
    });

    await completeBlingOrderSendJobInRepository({
      jobId,
      storeId: input.storeId,
      status: 'success',
      summary,
    });

    await recordBlingOrderSendEventInRepository({
      storeId: input.storeId,
      environment,
      status: 'success',
      summary,
    }).catch(() => undefined);

    return {
      status: 'success',
      orderId: order.id,
      orderNumber: order.orderNumber,
      externalId,
      tokenRefreshed: client.hasRefreshedToken(),
      testMode: isHomologation,
    };
  } catch (error) {
    const errorCode = getSafeErrorCode(error);
    const processedAt = new Date().toISOString();
    const summary = {
      jobId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      trigger: input.trigger,
      testMode: isHomologation,
      status: 'error',
      errorCode,
      draft: draftSummary,
      startedAt,
      processedAt,
      durationMs: toDurationMs(startedAt),
    };

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
      summary,
    });

    if (orderSendSettings.environment) {
      await recordBlingOrderSendEventInRepository({
        storeId: input.storeId,
        environment: orderSendSettings.environment as 'sandbox' | 'production',
        status: 'error',
        summary,
      }).catch(() => undefined);
    }

    return {
      status: 'error',
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode,
      testMode: isHomologation,
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
