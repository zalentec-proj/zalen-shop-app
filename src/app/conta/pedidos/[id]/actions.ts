'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env/server';
import { createOptionalClient } from '@/lib/supabase/server';
import { getCustomerOrderForUser } from '@/modules/customer-account/customer-account.service';
import {
  MercadoPagoPreferenceError,
  createCheckoutPreference,
} from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const retryPaymentSchema = z.object({
  orderId: z.string().trim().uuid(),
});

async function getBaseUrl() {
  const requestHeaders = await headers();

  return (
    requestHeaders.get('origin') ??
    getServerEnv().APP_URL ??
    'http://localhost:3000'
  );
}

function redirectToOrder(orderId: string, paymentState: string): never {
  redirect(
    `/conta/pedidos/${orderId}?payment=${encodeURIComponent(paymentState)}`
  );
}

export async function retryCustomerOrderPaymentAction(formData: FormData) {
  const parsed = retryPaymentSchema.safeParse({
    orderId: formData.get('orderId'),
  });

  if (!parsed.success) {
    redirect('/conta/pedidos');
  }

  const orderId = parsed.data.orderId;
  const supabase = await createOptionalClient();

  if (!supabase) {
    redirect(`/conta/entrar?next=/conta/pedidos/${orderId}`);
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(`/conta/entrar?next=/conta/pedidos/${orderId}`);
  }

  const store = await resolveCurrentStoreFromHeaders();
  const order = await getCustomerOrderForUser({
    storeId: store.id,
    authUserId: data.user.id,
    email: data.user.email,
    orderId,
  });

  if (!order) {
    redirect('/conta/pedidos?payment=not_found');
  }

  const isPaid =
    order.paymentStatus === 'paid' || order.payment?.status === 'approved';
  const isUnavailable =
    order.status === 'cancelled' ||
    order.paymentStatus === 'refunded' ||
    order.payment?.status === 'refunded';

  if (isPaid) {
    redirectToOrder(order.id, 'already_paid');
  }

  if (isUnavailable) {
    redirectToOrder(order.id, 'unavailable');
  }

  let checkoutUrl: string | undefined;

  try {
    const payment = await createCheckoutPreference({
      order,
      baseUrl: await getBaseUrl(),
    });

    checkoutUrl = payment.checkoutUrl;
  } catch (error) {
    if (error instanceof MercadoPagoPreferenceError) {
      redirectToOrder(order.id, 'mercado_pago_error');
    }

    redirectToOrder(order.id, 'retry_error');
  }

  if (!checkoutUrl) {
    redirectToOrder(order.id, 'retry_error');
  }

  redirect(checkoutUrl);
}
