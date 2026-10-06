import 'server-only';

import {
  getOrderByReferenceFromRepository,
  claimOrderBlingSendInRepository,
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
import { resolveBlingOrderReferences } from './bling-order-reference.service';
import type {
  BlingCreateSalesOrderResponse,
  BlingOrderSendResult,
} from './bling-order.types';

type SendOrderInput = {
  storeId: string;
  orderId: string;
  trigger: 'checkout' | 'admin_retry' | 'admin_test' | 'admin_manual';
};

function getSafeErrorCode(error: unknown) {
  if (error instanceof BlingApiClientError) {
    return error.status ? `${error.code}_${error.status}` : error.code;
  }

  if (error instanceof Error) {
    const safeErrorMessages = [
      'order_missing_customer_data',
      'order_missing_company_fiscal_data',
      'order_missing_items',
      'bling_order_response_missing_id',
      'bling_order_send_disabled',
      'order_payment_not_approved',
      'order_item_missing_sku',
      'bling_contact_response_missing_id',
      'bling_product_not_found_for_sku',
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
    return {
      status: 'error',
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode: 'order_payment_not_approved',
    };
  }

  if (order.status === 'cancelled') {
    return { status: 'error', orderId: order.id, errorCode: 'order_cancelled' };
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

  if (!orderSendSettings.enabled && !isHomologation && input.trigger !== 'admin_manual') {
    return {
      status: 'skipped',
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode: 'bling_order_send_disabled',
    };
  }

  if (orderSendSettings.status !== 'connected') {
    return { status: 'error', orderId: order.id, errorCode: 'bling_not_connected' };
  }

  if (['bling_order_send_in_progress', 'bling_order_send_uncertain'].includes(order.externalErpLastError ?? '')) {
    return { status: 'skipped', orderId: order.id, errorCode: order.externalErpLastError };
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

  if (!await claimOrderBlingSendInRepository(order)) {
    return { status: 'skipped', orderId: order.id, errorCode: 'order_send_already_running' };
  }
  let jobId: string | undefined;
  const startedAt = new Date().toISOString();
  let draftSummary: Record<string, unknown> | undefined;
  let salesOrderRequestStarted = false;
  let orderLinkSaved = false;
  let savedExternalId: string | undefined;

  try {
    jobId = await createBlingOrderSendJobInRepository({
      storeId: input.storeId, orderId: order.id,
      orderNumber: order.orderNumber, testMode: isHomologation,
    });
    const draft = mapOrderToBlingDraft(order, {
      paymentMethodId: orderSendSettings.paymentMethodId,
      isHomologation,
    });
    draftSummary = summarizeBlingOrderDraft(draft, { isHomologation });

    if (!draft.customer.name || !draft.customer.document) {
      throw new Error('order_missing_customer_data');
    }

    if (draft.payload.contato.tipoPessoa === 'J' &&
      (!(order.customerLegalName ?? order.customer?.legalName) ||
        (!draft.customer.stateRegistrationExempt && !draft.customer.stateRegistration))) {
      throw new Error('order_missing_company_fiscal_data');
    }

    if (draft.items.length === 0 || draft.payload.itens.length === 0) {
      throw new Error('order_missing_items');
    }

    const { client, environment } = await createBlingApiClientForStore(
      input.storeId
    );
    const payload = await resolveBlingOrderReferences(client, draft);
    salesOrderRequestStarted = true;
    const response = await client.request<BlingCreateSalesOrderResponse>(
      '/pedidos/vendas',
      {
        method: 'POST',
        body: payload,
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
    orderLinkSaved = true;
    savedExternalId = externalId;

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
    // A job/audit failure must not turn a successfully linked sale into a retry.
    if (orderLinkSaved) {
      return { status: 'success', orderId: order.id, orderNumber: order.orderNumber, externalId: savedExternalId, testMode: isHomologation };
    }
    // A timeout or persistence failure after POST may already have created the sale.
    // Keep a durable stop rather than treating an uncertain response as safe to retry.
    const definitelyRejected = error instanceof BlingApiClientError &&
      error.status !== undefined && [400, 401, 403, 404, 422, 429].includes(error.status);
    const errorCode = salesOrderRequestStarted && !definitelyRejected
      ? 'bling_order_send_uncertain' : getSafeErrorCode(error);
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

    if (!orderLinkSaved) await markOrderSendError({
      storeId: input.storeId,
      orderId: order.id,
      errorCode,
    });

    if (jobId) await completeBlingOrderSendJobInRepository({
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
