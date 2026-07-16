import 'server-only';

import { getServerEnv } from '@/lib/env/server';
import { getActivePrimaryStoreDomain } from '@/modules/domains/domain.repository';
import type { Order, OrderListItem } from '@/modules/orders/order.types';
import type { Shipment } from '@/modules/shipping/shipment.types';
import { getStoreByIdFromRepository } from '@/modules/stores/store.repository';
import {
  renderOrderReceivedEmail,
  renderPaymentStatusEmail,
  renderShipmentTrackingEmail,
} from './email.templates';
import { sendStoreEmail } from './email.service';
import type { StoreEmailResult, StoreEmailTemplateKey } from './email.types';

type PaymentEmailStatus = 'approved' | 'pending' | 'failed';
type EmailOrder = Order | OrderListItem;

const paymentTemplateByStatus: Record<PaymentEmailStatus, StoreEmailTemplateKey> = {
  approved: 'payment_approved',
  pending: 'payment_pending',
  failed: 'payment_failed',
};

async function getBaseUrl(storeId: string, baseUrl: string | undefined) {
  if (baseUrl) return baseUrl;

  const [primaryDomain, store] = await Promise.all([
    getActivePrimaryStoreDomain(storeId).catch(() => null),
    getStoreByIdFromRepository(storeId).catch(() => null),
  ]);

  if (primaryDomain) {
    return `https://${primaryDomain.hostname}`;
  }

  if (store) {
    const rootDomain = getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';
    return `https://${store.slug}.${rootDomain}`;
  }

  return getServerEnv().APP_URL ?? 'http://localhost:3000';
}

async function getOrderUrl(
  storeId: string,
  baseUrl: string | undefined,
  orderId: string
) {
  const resolvedBaseUrl = await getBaseUrl(storeId, baseUrl);
  return `${resolvedBaseUrl.replace(/\/$/, '')}/conta/pedidos/${orderId}`;
}

function getCustomerEmail(order: EmailOrder) {
  const listEmail = 'customerEmail' in order ? order.customerEmail : undefined;

  return listEmail ?? order.customer?.email;
}

function skippedResult(errorCode: string): StoreEmailResult {
  return {
    ok: false,
    status: 'skipped',
    errorCode,
  };
}

export async function sendOrderReceivedStoreEmail(input: {
  storeId: string;
  storeName: string;
  order: EmailOrder;
  baseUrl?: string;
}) {
  const recipientEmail = getCustomerEmail(input.order);

  if (!recipientEmail) {
    return skippedResult('order_email_missing');
  }

  const content = renderOrderReceivedEmail({
    storeName: input.storeName,
    orderNumber: input.order.orderNumber,
    orderUrl: await getOrderUrl(input.storeId, input.baseUrl, input.order.id),
  });

  return sendStoreEmail({
    storeId: input.storeId,
    templateKey: 'order_received',
    recipientEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey: `order-received:${input.storeId}:${input.order.id}`,
    metadata: {
      order_id: input.order.id,
      order_number: input.order.orderNumber,
    },
  });
}

export async function sendPaymentStatusStoreEmail(input: {
  storeId: string;
  storeName: string;
  order: EmailOrder;
  status: PaymentEmailStatus;
  baseUrl?: string;
}) {
  const recipientEmail = getCustomerEmail(input.order);

  if (!recipientEmail) {
    return skippedResult('order_email_missing');
  }

  const content = renderPaymentStatusEmail({
    storeName: input.storeName,
    orderNumber: input.order.orderNumber,
    orderUrl: await getOrderUrl(input.storeId, input.baseUrl, input.order.id),
    status: input.status,
  });

  return sendStoreEmail({
    storeId: input.storeId,
    templateKey: paymentTemplateByStatus[input.status],
    recipientEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey: `payment-${input.status}:${input.storeId}:${input.order.id}`,
    metadata: {
      order_id: input.order.id,
      order_number: input.order.orderNumber,
      payment_status: input.status,
    },
  });
}

export async function sendShipmentTrackingStoreEmail(input: {
  storeId: string;
  storeName: string;
  order: EmailOrder;
  shipment: Shipment;
  baseUrl?: string;
}) {
  const recipientEmail = getCustomerEmail(input.order);

  if (!recipientEmail) {
    return skippedResult('order_email_missing');
  }

  const content = renderShipmentTrackingEmail({
    storeName: input.storeName,
    orderNumber: input.order.orderNumber,
    orderUrl: await getOrderUrl(input.storeId, input.baseUrl, input.order.id),
    carrier: input.shipment.carrier,
    trackingCode: input.shipment.trackingCode,
    trackingUrl: input.shipment.trackingUrl,
  });

  return sendStoreEmail({
    storeId: input.storeId,
    templateKey: 'shipment_tracking',
    recipientEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey: `shipment:${input.storeId}:${input.shipment.id}:${input.shipment.updatedAt}`,
    metadata: {
      order_id: input.order.id,
      order_number: input.order.orderNumber,
      shipment_id: input.shipment.id,
      shipment_status: input.shipment.status,
    },
  });
}
