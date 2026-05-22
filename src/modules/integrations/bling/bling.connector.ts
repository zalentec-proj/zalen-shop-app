/**
 * Conector Bling — placeholder.
 * NÃO implementado. NÃO chama API real.
 * Tokens NUNCA devem aparecer aqui — apenas no servidor.
 *
 * Futuramente: implementar via Route Handlers do Next.js (server-side only).
 */

import { BlingOrder, BlingProduct } from './bling.types';

const NOT_IMPLEMENTED = 'Bling connector not implemented yet';

export async function syncProducts(_storeId: string): Promise<BlingProduct[]> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function syncOrders(_storeId: string): Promise<BlingOrder[]> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function pushOrder(
  _storeId: string,
  _orderId: string
): Promise<void> {
  throw new Error(NOT_IMPLEMENTED);
}
