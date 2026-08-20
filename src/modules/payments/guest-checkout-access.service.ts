import 'server-only';

import { getOrderByIdFromRepository } from '@/modules/orders/order.repository';
import { findCheckoutAttemptForOrderAccess } from './checkout-attempt.repository';
import { getGuestCheckoutAccess } from './guest-checkout-session';

export async function getGuestCheckoutOrderAccess(input: {
  storeId: string;
  orderId: string;
}) {
  const access = await getGuestCheckoutAccess(input);

  if (!access) {
    return null;
  }

  const attempt = await findCheckoutAttemptForOrderAccess({
    storeId: input.storeId,
    orderId: input.orderId,
    attemptKey: access.attemptKey,
  });

  if (!attempt) {
    return null;
  }

  const order = await getOrderByIdFromRepository(input.storeId, input.orderId);

  return order ? { attempt, order } : null;
}
