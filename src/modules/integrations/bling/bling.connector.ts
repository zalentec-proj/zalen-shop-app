/**
 * Conector Bling — placeholder.
 * NÃO implementado. NÃO chama API real.
 * Tokens NUNCA devem aparecer aqui — apenas no servidor.
 *
 * Futuramente: implementar via Route Handlers do Next.js (server-side only).
 */

import { BlingOrder, BlingProduct } from './bling.types';
import { sendOrderToBling } from './orders/bling-order-send.service';

const NOT_IMPLEMENTED = 'Bling connector not implemented yet';

export async function syncProducts(_storeId: string): Promise<BlingProduct[]> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function syncOrders(_storeId: string): Promise<BlingOrder[]> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function pushOrder(
  storeId: string,
  orderId: string
): Promise<void> {
  const result = await sendOrderToBling({
    storeId,
    orderId,
    trigger: 'admin_retry',
  });

  if (result.status === 'error') {
    throw new Error(result.errorCode ?? 'bling_order_send_failed');
  }
}
