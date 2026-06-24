import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type { UpsertPaymentTransactionInput } from './payment-transaction.types';

export async function upsertPaymentTransaction(
  input: UpsertPaymentTransactionInput
) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('Unable to save payment transaction.');
  }

  const { error } = await supabase.from('payment_transactions').upsert(
    {
      store_id: input.storeId,
      order_id: input.orderId,
      provider: input.provider,
      provider_reference: input.providerReference,
      external_payment_id: input.externalPaymentId,
      external_reference: input.externalReference,
      status: input.status,
      amount: input.amount,
      checkout_url: input.checkoutUrl,
      sandbox_checkout_url: input.sandboxCheckoutUrl,
      raw_status: input.rawStatus,
      raw_status_detail: input.rawStatusDetail,
      approved_at: input.approvedAt,
      processed_at: input.processedAt,
      last_error: input.lastError,
      metadata_json: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'store_id,order_id,provider',
    }
  );

  if (error) {
    throw new Error('Unable to save payment transaction.');
  }
}
