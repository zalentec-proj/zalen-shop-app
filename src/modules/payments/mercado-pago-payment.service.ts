import 'server-only';

import {
  MercadoPagoPaymentLookupError,
  getMercadoPagoPayment,
} from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import type { MercadoPagoEnvironment } from '@/modules/integrations/mercado-pago/mercado-pago.types';
import { tryAutoSendOrderToBling } from '@/modules/integrations/bling/orders/bling-order-send.service';
import {
  getStaticActiveStoreContext,
  getStoreByIdFromRepository,
} from '@/modules/stores/store.repository';
import { sendPaymentStatusStoreEmail } from '@/modules/email/store-transactional-email.service';
import { dispatchPurchaseMarketingEvent } from '@/modules/marketing/marketing.service';
import {
  getOrderByIdFromRepository,
  markOrderPaymentApprovedIfPendingInRepository,
  updateOrderPaymentStateInRepository,
} from '@/modules/orders/order.repository';
import type {
  OrderListItem,
  OrderStatus,
  PaymentStatus,
} from '@/modules/orders/order.types';
import { upsertPaymentTransaction } from './payment-transaction.repository';
import type { PaymentTransactionStatus } from './payment-transaction.types';

type PaymentUpdateSource = 'return' | 'webhook';

export type MercadoPagoPaymentProcessingStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'error';

export interface MercadoPagoPaymentProcessingResult {
  ok: boolean;
  status: MercadoPagoPaymentProcessingStatus;
  orderId?: string;
  orderNumber?: string;
  paymentId?: string;
  alreadyPaid?: boolean;
  blingTriggered?: boolean;
  errorCode?: string;
}

interface PaymentStateMapping {
  transactionStatus: PaymentTransactionStatus;
  resultStatus: MercadoPagoPaymentProcessingStatus;
  orderPaymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
  lastError?: string;
}

function mapMercadoPagoStatus(status: string | undefined): PaymentStateMapping {
  switch (status) {
    case 'approved':
      return {
        transactionStatus: 'approved',
        resultStatus: 'approved',
        orderPaymentStatus: 'paid',
        orderStatus: 'confirmed',
      };
    case 'pending':
    case 'in_process':
    case 'authorized':
    case 'in_mediation':
      return {
        transactionStatus: 'pending',
        resultStatus: 'pending',
        orderPaymentStatus: 'pending',
      };
    case 'rejected':
      return {
        transactionStatus: 'rejected',
        resultStatus: 'rejected',
        orderPaymentStatus: 'failed',
      };
    case 'cancelled':
    case 'charged_back':
      return {
        transactionStatus: 'cancelled',
        resultStatus: 'cancelled',
        orderPaymentStatus: 'failed',
      };
    case 'refunded':
      return {
        transactionStatus: 'refunded',
        resultStatus: 'refunded',
        orderPaymentStatus: 'refunded',
      };
    default:
      return {
        transactionStatus: 'error',
        resultStatus: 'error',
        lastError: status ? `unsupported_status:${status}` : 'missing_status',
      };
  }
}

function amountsMatch(paymentAmount: number | undefined, order: OrderListItem) {
  if (typeof paymentAmount !== 'number') {
    return false;
  }

  return Math.round(paymentAmount * 100) === Math.round(order.total * 100);
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];

  return typeof value === 'string' ? value : undefined;
}

function getExpectedLiveMode(environment: MercadoPagoEnvironment | undefined) {
  if (!environment) {
    return undefined;
  }

  return environment === 'production';
}

function getReconciliationError(input: {
  payment: Awaited<ReturnType<typeof getMercadoPagoPayment>>;
  order: OrderListItem;
  storeId: string;
  environment?: MercadoPagoEnvironment;
  transactionStatus: PaymentTransactionStatus;
}) {
  const metadataOrderId = getMetadataString(input.payment.metadata, 'order_id');
  const metadataStoreId = getMetadataString(input.payment.metadata, 'store_id');

  if (metadataOrderId && metadataOrderId !== input.order.id) {
    return 'payment_metadata_order_mismatch';
  }

  if (metadataStoreId && metadataStoreId !== input.storeId) {
    return 'payment_metadata_store_mismatch';
  }

  if (
    input.transactionStatus === 'approved' &&
    input.payment.currencyId &&
    input.payment.currencyId !== 'BRL'
  ) {
    return 'payment_currency_mismatch';
  }

  const expectedLiveMode = getExpectedLiveMode(input.environment);

  if (
    typeof expectedLiveMode === 'boolean' &&
    typeof input.payment.liveMode === 'boolean' &&
    input.payment.liveMode !== expectedLiveMode
  ) {
    return 'payment_environment_mismatch';
  }

  return undefined;
}

function toSafeLookupError(error: unknown) {
  if (error instanceof MercadoPagoPaymentLookupError) {
    return `mercado_pago_lookup_failed:${error.status}:${error.reason}`;
  }

  if (error instanceof Error && error.message === 'mercado_pago_not_configured') {
    return error.message;
  }

  return 'mercado_pago_lookup_failed';
}

async function persistPaymentState(input: {
  storeId: string;
  order: OrderListItem;
  paymentId: string;
  rawStatus?: string;
  rawStatusDetail?: string;
  transactionStatus: PaymentTransactionStatus;
  lastError?: string;
  amount: number;
  source: PaymentUpdateSource;
  approvedAt?: string;
  currencyId?: string;
  liveMode?: boolean;
  environment?: MercadoPagoEnvironment;
}) {
  const processedAt = new Date().toISOString();

  await upsertPaymentTransaction({
    storeId: input.storeId,
    orderId: input.order.id,
    provider: 'mercado_pago',
    externalPaymentId: input.paymentId,
    externalReference: input.order.id,
    status: input.transactionStatus,
    amount: input.amount,
    rawStatus: input.rawStatus,
    rawStatusDetail: input.rawStatusDetail,
    approvedAt: input.approvedAt,
    processedAt,
    lastError: input.lastError,
    metadata: {
      source: input.source,
      order_number: input.order.orderNumber,
      environment: input.environment,
      currency_id: input.currencyId,
      live_mode: input.liveMode,
    },
  });
}

export async function processMercadoPagoPaymentUpdate(input: {
  storeId: string;
  paymentId: string;
  environment?: MercadoPagoEnvironment;
  source: PaymentUpdateSource;
}): Promise<MercadoPagoPaymentProcessingResult> {
  let payment;

  try {
    payment = await getMercadoPagoPayment({
      storeId: input.storeId,
      paymentId: input.paymentId,
      environment: input.environment,
    });
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      paymentId: input.paymentId,
      errorCode: toSafeLookupError(error),
    };
  }

  if (!payment.externalReference) {
    return {
      ok: false,
      status: 'error',
      paymentId: payment.id,
      errorCode: 'payment_external_reference_missing',
    };
  }

  const order = await getOrderByIdFromRepository(
    input.storeId,
    payment.externalReference
  );

  if (!order) {
    return {
      ok: false,
      status: 'error',
      paymentId: payment.id,
      orderId: payment.externalReference,
      errorCode: 'order_not_found',
    };
  }

  const mapping = mapMercadoPagoStatus(payment.status);
  const amount = payment.transactionAmount ?? order.total;
  const reconciliationError = getReconciliationError({
    payment,
    order,
    storeId: input.storeId,
    environment: input.environment,
    transactionStatus: mapping.transactionStatus,
  });

  if (
    mapping.transactionStatus === 'approved' &&
    !amountsMatch(payment.transactionAmount, order)
  ) {
    await persistPaymentState({
      storeId: input.storeId,
      order,
      paymentId: payment.id,
      rawStatus: payment.status,
      rawStatusDetail: payment.statusDetail,
      transactionStatus: 'error',
      amount,
      source: input.source,
      lastError: 'payment_amount_mismatch',
      currencyId: payment.currencyId,
      liveMode: payment.liveMode,
      environment: input.environment,
    });

    return {
      ok: false,
      status: 'error',
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode: 'payment_amount_mismatch',
    };
  }

  if (reconciliationError) {
    await persistPaymentState({
      storeId: input.storeId,
      order,
      paymentId: payment.id,
      rawStatus: payment.status,
      rawStatusDetail: payment.statusDetail,
      transactionStatus: 'error',
      amount,
      source: input.source,
      lastError: reconciliationError,
      currencyId: payment.currencyId,
      liveMode: payment.liveMode,
      environment: input.environment,
    });

    return {
      ok: false,
      status: 'error',
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorCode: reconciliationError,
    };
  }

  const approvedAt =
    mapping.transactionStatus === 'approved'
      ? new Date().toISOString()
      : undefined;

  await persistPaymentState({
    storeId: input.storeId,
    order,
    paymentId: payment.id,
    rawStatus: payment.status,
    rawStatusDetail: payment.statusDetail,
    transactionStatus: mapping.transactionStatus,
    amount,
    source: input.source,
    approvedAt,
    lastError: mapping.lastError,
    currencyId: payment.currencyId,
    liveMode: payment.liveMode,
    environment: input.environment,
  });

  let transitionedToPaid = false;

  if (mapping.transactionStatus === 'approved') {
    transitionedToPaid = await markOrderPaymentApprovedIfPendingInRepository({
      storeId: input.storeId,
      orderId: order.id,
    });
  } else if (mapping.orderPaymentStatus) {
    await updateOrderPaymentStateInRepository({
      storeId: input.storeId,
      orderId: order.id,
      paymentStatus: mapping.orderPaymentStatus,
      status: mapping.orderStatus,
    });
  }

  const wasAlreadyPaid = order.paymentStatus === 'paid';
  let blingTriggered = false;

  if (mapping.transactionStatus === 'approved' && transitionedToPaid) {
    await dispatchPurchaseMarketingEvent({
      storeId: input.storeId,
      order,
    }).catch(() => undefined);

    blingTriggered = true;
    await tryAutoSendOrderToBling({
      storeId: input.storeId,
      orderId: order.id,
    });
  }

  const store =
    (await getStoreByIdFromRepository(input.storeId)) ??
    getStaticActiveStoreContext();

  if (mapping.transactionStatus === 'approved' && transitionedToPaid) {
    await sendPaymentStatusStoreEmail({
      storeId: input.storeId,
      storeName: store.shortName,
      order,
      status: 'approved',
    }).catch(() => undefined);
  } else if (mapping.orderPaymentStatus === 'pending') {
    await sendPaymentStatusStoreEmail({
      storeId: input.storeId,
      storeName: store.shortName,
      order,
      status: 'pending',
    }).catch(() => undefined);
  } else if (mapping.orderPaymentStatus === 'failed') {
    await sendPaymentStatusStoreEmail({
      storeId: input.storeId,
      storeName: store.shortName,
      order,
      status: 'failed',
    }).catch(() => undefined);
  }

  return {
    ok: mapping.transactionStatus !== 'error',
    status: mapping.resultStatus,
    paymentId: payment.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    alreadyPaid: wasAlreadyPaid,
    blingTriggered,
    errorCode: mapping.lastError,
  };
}
