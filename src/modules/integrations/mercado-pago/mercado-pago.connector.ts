/**
 * Conector Mercado Pago — placeholder.
 * NÃO implementado. NÃO chama API real.
 * Tokens NUNCA devem aparecer aqui — apenas no servidor.
 */

import { PaymentIntent, PaymentResult } from './mercado-pago.types';

const NOT_IMPLEMENTED = 'Mercado Pago connector not implemented yet';

export async function createPayment(
  _intent: PaymentIntent
): Promise<PaymentResult> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function getPaymentStatus(
  _externalId: string
): Promise<PaymentResult> {
  throw new Error(NOT_IMPLEMENTED);
}
