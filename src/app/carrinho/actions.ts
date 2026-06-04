'use server';

import { z } from 'zod';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { createOrder } from '@/modules/orders/order.service';

const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().max(99),
});

const checkoutSchema = z.array(checkoutItemSchema).min(1).max(50);

export type CheckoutCartActionResult =
  | {
      ok: true;
      orderNumber: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function checkoutCartAction(
  rawItems: unknown
): Promise<CheckoutCartActionResult> {
  const parsed = checkoutSchema.safeParse(rawItems);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Carrinho inválido. Revise os itens e tente novamente.',
    };
  }

  try {
    const order = await createOrder({
      storeId: ACTIVE_STORE_ID,
      items: parsed.data,
    });

    return {
      ok: true,
      orderNumber: order.orderNumber,
    };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível criar o pedido agora.',
    };
  }
}
