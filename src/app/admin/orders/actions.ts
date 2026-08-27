'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import {
  getOrderById,
  markOrderShipmentState,
} from '@/modules/orders/order.service';
import { sendShipmentTrackingStoreEmail } from '@/modules/email/store-transactional-email.service';
import { upsertManualShipment } from '@/modules/shipping/shipment.service';
import type { ShipmentStatus } from '@/modules/shipping/shipment.types';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { enqueueShipmentWhatsAppNotification } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service';
import { adminActionError, adminActionSuccess, type AdminActionResult } from '@/modules/admin/admin-action-result';

const writableStoreRoles: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_operator',
];

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const trackingUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const shipmentSchema = z.object({
  orderId: z.string().uuid(),
  carrier: optionalText,
  trackingCode: optionalText,
  trackingUrl,
  status: z.enum([
    'pending',
    'posted',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'exception',
    'cancelled',
  ]),
});

function getOrderShipmentState(status: ShipmentStatus) {
  if (status === 'delivered') {
    return {
      status: 'delivered' as const,
      fulfillmentStatus: 'fulfilled' as const,
    };
  }

  if (status === 'pending' || status === 'cancelled') {
    return {
      status: 'processing' as const,
      fulfillmentStatus: 'unfulfilled' as const,
    };
  }

  return {
    status: 'shipped' as const,
    fulfillmentStatus: 'partial' as const,
  };
}

export async function upsertOrderShipmentAction(formData: FormData): Promise<AdminActionResult> {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableStoreRoles);

  if (!access.allowed) {
    return adminActionError('Você não possui permissão para alterar o envio.');
  }

  const parsed = shipmentSchema.safeParse({
    orderId: formData.get('orderId'),
    carrier: formData.get('carrier'),
    trackingCode: formData.get('trackingCode'),
    trackingUrl: formData.get('trackingUrl'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return adminActionError('Revise os dados de separação e rastreio.');
  }

  const order = await getOrderById(store.id, parsed.data.orderId);

  if (!order || order.paymentStatus !== 'paid') {
    return adminActionError('O envio só pode ser alterado após a confirmação do pagamento.');
  }

  const shipment = await upsertManualShipment({
    storeId: store.id,
    orderId: parsed.data.orderId,
    carrier: parsed.data.carrier,
    trackingCode: parsed.data.trackingCode,
    trackingUrl: parsed.data.trackingUrl,
    status: parsed.data.status,
    shippedAt:
      parsed.data.status === 'posted' ||
      parsed.data.status === 'in_transit' ||
      parsed.data.status === 'out_for_delivery' ||
      parsed.data.status === 'delivered'
        ? new Date().toISOString()
        : undefined,
    deliveredAt:
      parsed.data.status === 'delivered' ? new Date().toISOString() : undefined,
  });

  if (!shipment) {
    return adminActionError('Não foi possível salvar os dados de envio.');
  }

  await markOrderShipmentState({
    storeId: store.id,
    orderId: parsed.data.orderId,
    ...getOrderShipmentState(parsed.data.status),
  });

  await sendShipmentTrackingStoreEmail({
    storeId: store.id,
    storeName: store.shortName,
    order,
    shipment,
  }).catch(() => undefined);
  await enqueueShipmentWhatsAppNotification({
    storeId: store.id,
    storeName: store.shortName,
    order,
    shipmentStatus: shipment.status,
    trackingUrl: shipment.trackingUrl,
  }).catch(() => undefined);

  revalidatePath('/admin');
  revalidatePath('/admin/pedidos');
  revalidatePath('/conta');
  revalidatePath('/conta/pedidos');
  revalidatePath(`/conta/pedidos/${parsed.data.orderId}`);
  return adminActionSuccess('Dados de envio salvos com sucesso.');
}
