import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';

export type CheckoutAttemptStatus =
  | 'processing'
  | 'preference_created'
  | 'error';

export interface CheckoutAttemptRecord {
  id: string;
  storeId: string;
  attemptKey: string;
  cartHash: string;
  customerHash: string;
  status: CheckoutAttemptStatus;
  orderId?: string;
  orderNumber?: string;
  provider: 'mercado_pago';
  providerReference?: string;
  checkoutUrl?: string;
  sandboxCheckoutUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type ReserveCheckoutAttemptResult =
  | {
      state: 'reserved';
      attempt: CheckoutAttemptRecord;
    }
  | {
      state: 'completed';
      attempt: CheckoutAttemptRecord;
    }
  | {
      state: 'in_progress';
      attempt: CheckoutAttemptRecord;
    }
  | {
      state: 'fingerprint_mismatch';
      attempt: CheckoutAttemptRecord;
    };

type CheckoutAttemptRow = {
  id: string;
  store_id: string;
  attempt_key: string;
  cart_hash: string;
  customer_hash: string;
  status: string;
  order_id: string | null;
  order_number: string | null;
  provider: string;
  provider_reference: string | null;
  checkout_url: string | null;
  sandbox_checkout_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export class CheckoutAttemptPersistenceError extends Error {
  constructor(readonly safeReason: string) {
    super('checkout_attempt_persistence_failed');
    this.name = 'CheckoutAttemptPersistenceError';
  }
}

function toCheckoutAttempt(row: CheckoutAttemptRow): CheckoutAttemptRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    attemptKey: row.attempt_key,
    cartHash: row.cart_hash,
    customerHash: row.customer_hash,
    status: row.status as CheckoutAttemptStatus,
    orderId: row.order_id ?? undefined,
    orderNumber: row.order_number ?? undefined,
    provider: 'mercado_pago',
    providerReference: row.provider_reference ?? undefined,
    checkoutUrl: row.checkout_url ?? undefined,
    sandboxCheckoutUrl: row.sandbox_checkout_url ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function throwPersistenceError(reason: string): never {
  throw new CheckoutAttemptPersistenceError(reason);
}

export async function reserveCheckoutAttempt(input: {
  storeId: string;
  attemptKey: string;
  cartHash: string;
  customerHash: string;
}): Promise<ReserveCheckoutAttemptResult> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throwPersistenceError('supabase_admin_unavailable');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('checkout_attempts')
    .insert({
      store_id: input.storeId,
      attempt_key: input.attemptKey,
      cart_hash: input.cartHash,
      customer_hash: input.customerHash,
      status: 'processing',
      provider: 'mercado_pago',
      updated_at: now,
    })
    .select('*')
    .single();

  if (!error && data) {
    return {
      state: 'reserved',
      attempt: toCheckoutAttempt(data as CheckoutAttemptRow),
    };
  }

  if (error?.code !== '23505') {
    throwPersistenceError('insert_failed');
  }

  const { data: existing, error: fetchError } = await supabase
    .from('checkout_attempts')
    .select('*')
    .eq('store_id', input.storeId)
    .eq('attempt_key', input.attemptKey)
    .maybeSingle();

  if (fetchError || !existing) {
    throwPersistenceError('lookup_failed');
  }

  const existingAttempt = toCheckoutAttempt(existing as CheckoutAttemptRow);

  if (
    existingAttempt.cartHash !== input.cartHash ||
    existingAttempt.customerHash !== input.customerHash
  ) {
    return {
      state: 'fingerprint_mismatch',
      attempt: existingAttempt,
    };
  }

  if (
    existingAttempt.status === 'preference_created' &&
    existingAttempt.checkoutUrl
  ) {
    return {
      state: 'completed',
      attempt: existingAttempt,
    };
  }

  if (existingAttempt.status === 'error') {
    const { data: retried, error: retryError } = await supabase
      .from('checkout_attempts')
      .update({
        status: 'processing',
        error_message: null,
        updated_at: now,
      })
      .eq('id', existingAttempt.id)
      .eq('store_id', input.storeId)
      .eq('status', 'error')
      .select('*')
      .single();

    if (retryError || !retried) {
      throwPersistenceError('retry_failed');
    }

    return {
      state: 'reserved',
      attempt: toCheckoutAttempt(retried as CheckoutAttemptRow),
    };
  }

  return {
    state: 'in_progress',
    attempt: existingAttempt,
  };
}

export async function findReusableCheckoutAttempt(input: {
  storeId: string;
  cartHash: string;
  customerHash: string;
  maxAgeMinutes?: number;
}): Promise<CheckoutAttemptRecord | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throwPersistenceError('supabase_admin_unavailable');
  }

  const minCreatedAt = new Date(
    Date.now() - (input.maxAgeMinutes ?? 180) * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from('checkout_attempts')
    .select('*')
    .eq('store_id', input.storeId)
    .eq('cart_hash', input.cartHash)
    .eq('customer_hash', input.customerHash)
    .eq('status', 'preference_created')
    .gte('created_at', minCreatedAt)
    .not('order_id', 'is', null)
    .not('checkout_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwPersistenceError('reuse_lookup_failed');
  }

  return data ? toCheckoutAttempt(data as CheckoutAttemptRow) : null;
}

export async function completeCheckoutAttempt(input: {
  storeId: string;
  attemptId: string;
  orderId: string;
  orderNumber: string;
  providerReference: string;
  checkoutUrl: string;
  sandboxCheckoutUrl?: string;
}): Promise<CheckoutAttemptRecord> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throwPersistenceError('supabase_admin_unavailable');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('checkout_attempts')
    .update({
      status: 'preference_created',
      order_id: input.orderId,
      order_number: input.orderNumber,
      provider_reference: input.providerReference,
      checkout_url: input.checkoutUrl,
      sandbox_checkout_url: input.sandboxCheckoutUrl,
      error_message: null,
      updated_at: now,
      completed_at: now,
    })
    .eq('id', input.attemptId)
    .eq('store_id', input.storeId)
    .select('*')
    .single();

  if (error || !data) {
    throwPersistenceError('complete_failed');
  }

  return toCheckoutAttempt(data as CheckoutAttemptRow);
}

export async function markCheckoutAttemptError(input: {
  storeId: string;
  attemptId: string;
  errorMessage: string;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throwPersistenceError('supabase_admin_unavailable');
  }

  const { error } = await supabase
    .from('checkout_attempts')
    .update({
      status: 'error',
      error_message: input.errorMessage.slice(0, 220),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.attemptId)
    .eq('store_id', input.storeId);

  if (error) {
    throwPersistenceError('mark_error_failed');
  }
}
