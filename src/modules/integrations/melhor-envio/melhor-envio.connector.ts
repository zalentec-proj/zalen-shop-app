/**
 * Conector Melhor Envio — placeholder.
 * NÃO implementado. NÃO chama API real.
 * Tokens NUNCA devem aparecer aqui — apenas no servidor.
 */

import { ShippingOption, ShippingQuoteInput } from './melhor-envio.types';

const NOT_IMPLEMENTED = 'Melhor Envio connector not implemented yet';

export async function getShippingQuotes(
  _input: ShippingQuoteInput
): Promise<ShippingOption[]> {
  throw new Error(NOT_IMPLEMENTED);
}
