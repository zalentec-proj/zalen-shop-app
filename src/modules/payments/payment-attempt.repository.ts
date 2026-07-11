import 'server-only';

import { createHash } from 'node:crypto';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import type { PaymentTransactionStatus } from './payment-transaction.types';

export type PaymentAttempt = {
  id: string;
  storeId: string;
  orderId: string;
  provider: 'mercado_pago';
  environment: 'test' | 'production';
  idempotencyKeyHash: string;
  paymentMethodId?: string;
  paymentTypeId?: string;
  externalPaymentId?: string;
  status: PaymentTransactionStatus;
  statusDetail?: string;
  amount: number;
  instructions: Record<string, unknown>;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

type PaymentAttemptRow = {
  id: string;
  store_id: string;
  order_id: string;
  provider: 'mercado_pago';
  environment: 'test' | 'production';
  idempotency_key_hash: string;
  payment_method_id: string | null;
  payment_type_id: string | null;
  external_payment_id: string | null;
  status: PaymentTransactionStatus;
  status_detail: string | null;
  amount: number | string;
  instructions_json: Record<string, unknown> | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function mapAttempt(row: PaymentAttemptRow): PaymentAttempt {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    provider: row.provider,
    environment: row.environment,
    idempotencyKeyHash: row.idempotency_key_hash,
    paymentMethodId: row.payment_method_id ?? undefined,
    paymentTypeId: row.payment_type_id ?? undefined,
    externalPaymentId: row.external_payment_id ?? undefined,
    status: row.status,
    statusDetail: row.status_detail ?? undefined,
    amount: Number(row.amount),
    instructions: row.instructions_json ?? {},
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

export function hashPaymentAttemptKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function reservePaymentAttempt(input: {
  storeId: string;
  orderId: string;
  environment: 'test' | 'production';
  idempotencyKey: string;
  paymentMethodId?: string;
  amount: number;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('payment_attempt_storage_unavailable');
  }

  const idempotencyKeyHash = hashPaymentAttemptKey(input.idempotencyKey);
  const { data, error } = await supabase
    .from('payment_attempts')
    .insert({
      store_id: input.storeId,
      order_id: input.orderId,
      provider: 'mercado_pago',
      environment: input.environment,
      idempotency_key_hash: idempotencyKeyHash,
      payment_method_id: input.paymentMethodId,
      amount: input.amount,
      status: 'created',
    })
    .select(
      'id,store_id,order_id,provider,environment,idempotency_key_hash,payment_method_id,payment_type_id,external_payment_id,status,status_detail,amount,instructions_json,last_error,created_at,updated_at,completed_at'
    )
    .single();

  if (!error && data) {
    return { state: 'reserved' as const, attempt: mapAttempt(data as PaymentAttemptRow) };
  }

  if (error?.code !== '23505') {
    throw new Error('payment_attempt_reserve_failed');
  }

  const { data: existing, error: existingError } = await supabase
    .from('payment_attempts')
    .select(
      'id,store_id,order_id,provider,environment,idempotency_key_hash,payment_method_id,payment_type_id,external_payment_id,status,status_detail,amount,instructions_json,last_error,created_at,updated_at,completed_at'
    )
    .eq('store_id', input.storeId)
    .eq('order_id', input.orderId)
    .eq('provider', 'mercado_pago')
    .eq('idempotency_key_hash', idempotencyKeyHash)
    .maybeSingle();

  if (existingError || !existing) {
    throw new Error('payment_attempt_lookup_failed');
  }

  return { state: 'existing' as const, attempt: mapAttempt(existing as PaymentAttemptRow) };
}

export async function updatePaymentAttempt(input: {
  attemptId: string;
  storeId: string;
  externalPaymentId?: string;
  paymentMethodId?: string;
  paymentTypeId?: string;
  status: PaymentTransactionStatus;
  statusDetail?: string;
  instructions?: Record<string, unknown>;
  lastError?: string;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return;
  }

  const completed = ['approved', 'rejected', 'cancelled', 'refunded', 'error'].includes(
    input.status
  );
  const payload: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
    completed_at: completed ? new Date().toISOString() : null,
  };

  if (input.externalPaymentId !== undefined) {
    payload.external_payment_id = input.externalPaymentId;
  }

  if (input.paymentMethodId !== undefined) {
    payload.payment_method_id = input.paymentMethodId;
  }

  if (input.paymentTypeId !== undefined) {
    payload.payment_type_id = input.paymentTypeId;
  }

  if (input.statusDetail !== undefined) {
    payload.status_detail = input.statusDetail;
  }

  if (input.instructions !== undefined) {
    payload.instructions_json = input.instructions;
  }

  if (input.lastError !== undefined) {
    payload.last_error = input.lastError;
  }

  const { error } = await supabase
    .from('payment_attempts')
    .update(payload)
    .eq('id', input.attemptId)
    .eq('store_id', input.storeId);

  if (error) {
    throw new Error('payment_attempt_update_failed');
  }
}

export async function listPendingPaymentAttempts(input: {
  maxAgeMinutes?: number;
  limit?: number;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return [] as PaymentAttempt[];
  }

  const cutoff = new Date(
    Date.now() - (input.maxAgeMinutes ?? 24 * 60) * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from('payment_attempts')
    .select(
      'id,store_id,order_id,provider,environment,idempotency_key_hash,payment_method_id,payment_type_id,external_payment_id,status,status_detail,amount,instructions_json,last_error,created_at,updated_at,completed_at'
    )
    .in('status', ['created', 'pending'])
    .not('external_payment_id', 'is', null)
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(input.limit ?? 100);

  if (error || !data) {
    return [] as PaymentAttempt[];
  }

  return (data as PaymentAttemptRow[]).map(mapAttempt);
}
