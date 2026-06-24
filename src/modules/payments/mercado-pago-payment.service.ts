import 'server-only';

import {
  MercadoPagoPaymentLookupError,
  getMercadoPagoPayment,
} from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import { tryAutoSendOrderToBling } from '@/modules/integrations/bling/orders/bling-order-send.service';
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
    },
  });
}

export async function processMercadoPagoPaymentUpdate(input: {
  storeId: string;
  paymentId: string;
  source: PaymentUpdateSource;
}): Promise<MercadoPagoPaymentProcessingResult> {
  let payment;

  try {
    payment = await getMercadoPagoPayment(input.paymentId);
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
    blingTriggered = true;
    await tryAutoSendOrderToBling({
      storeId: input.storeId,
      orderId: order.id,
    });
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
