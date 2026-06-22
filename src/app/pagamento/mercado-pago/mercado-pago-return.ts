import 'server-only';

import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import {
  type MercadoPagoPaymentProcessingResult,
  processMercadoPagoPaymentUpdate,
} from '@/modules/payments/mercado-pago-payment.service';

export type MercadoPagoReturnSearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function processMercadoPagoReturn(
  searchParams: MercadoPagoReturnSearchParams
): Promise<MercadoPagoPaymentProcessingResult | null> {
  const params = (await searchParams) ?? {};
  const paymentId =
    firstParam(params.payment_id) ??
    firstParam(params.collection_id) ??
    firstParam(params['data.id']);

  if (!paymentId) {
    return null;
  }

  try {
    return await processMercadoPagoPaymentUpdate({
      storeId: ACTIVE_STORE_ID,
      paymentId,
      source: 'return',
    });
  } catch {
    return {
      ok: false,
      status: 'error',
      paymentId,
      errorCode: 'payment_return_processing_failed',
    };
  }
}
