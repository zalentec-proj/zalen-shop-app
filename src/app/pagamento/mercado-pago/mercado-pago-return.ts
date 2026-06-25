import 'server-only';

import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import {
  type MercadoPagoPaymentProcessingResult,
  processMercadoPagoPaymentUpdate,
} from '@/modules/payments/mercado-pago-payment.service';
import { parseMercadoPagoEnvironment } from '@/modules/integrations/mercado-pago/mercado-pago.config';

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
  const environment = parseMercadoPagoEnvironment(firstParam(params.environment));

  if (!paymentId) {
    return null;
  }

  try {
    const store = await resolveCurrentStoreFromHeaders();
    return await processMercadoPagoPaymentUpdate({
      storeId: store.id,
      paymentId,
      environment: environment ?? undefined,
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
