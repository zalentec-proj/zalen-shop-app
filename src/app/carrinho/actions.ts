'use server';

import { z } from 'zod';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { createOrder } from '@/modules/orders/order.service';

const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().max(99),
});

const optionalCheckoutString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  document: z.string().trim().min(11),
  shippingAddress: z
    .object({
      postalCode: optionalCheckoutString,
      street: optionalCheckoutString,
      number: optionalCheckoutString,
      complement: optionalCheckoutString,
      district: optionalCheckoutString,
      city: optionalCheckoutString,
      state: optionalCheckoutString,
    })
    .optional(),
});

const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  customer: checkoutCustomerSchema,
});

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
  rawInput: unknown
): Promise<CheckoutCartActionResult> {
  const parsed = checkoutSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Revise os dados do cliente e os itens do carrinho.',
    };
  }

  try {
    const order = await createOrder({
      storeId: ACTIVE_STORE_ID,
      customer: parsed.data.customer,
      items: parsed.data.items,
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
