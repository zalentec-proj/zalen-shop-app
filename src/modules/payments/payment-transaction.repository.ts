import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  PaymentProvider,
  PaymentTransaction,
  PaymentTransactionStatus,
  UpsertPaymentTransactionInput,
} from './payment-transaction.types';

type PaymentTransactionRow = {
  id: string;
  store_id: string;
  order_id: string;
  provider: string;
  provider_reference: string | null;
  external_payment_id: string | null;
  external_reference: string;
  status: string;
  amount: number | string | null;
  checkout_url: string | null;
  sandbox_checkout_url: string | null;
  raw_status: string | null;
  raw_status_detail: string | null;
  approved_at: string | null;
  processed_at: string | null;
  last_error: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toProvider(value: string): PaymentProvider {
  return value === 'mercado_pago' ? 'mercado_pago' : 'mercado_pago';
}

function toStatus(value: string): PaymentTransactionStatus {
  const allowed: PaymentTransactionStatus[] = [
    'created',
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'refunded',
    'error',
  ];

  return allowed.includes(value as PaymentTransactionStatus)
    ? (value as PaymentTransactionStatus)
    : 'error';
}

function mapPaymentTransaction(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    provider: toProvider(row.provider),
    providerReference: row.provider_reference ?? undefined,
    externalPaymentId: row.external_payment_id ?? undefined,
    externalReference: row.external_reference,
    status: toStatus(row.status),
    amount: toNumber(row.amount),
    checkoutUrl: row.checkout_url ?? undefined,
    sandboxCheckoutUrl: row.sandbox_checkout_url ?? undefined,
    rawStatus: row.raw_status ?? undefined,
    rawStatusDetail: row.raw_status_detail ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    processedAt: row.processed_at ?? undefined,
    lastError: row.last_error ?? undefined,
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

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

export async function listPaymentTransactionsByOrderIds(input: {
  storeId: string;
  orderIds: string[];
}): Promise<PaymentTransaction[]> {
  const supabase = createOptionalAdminClient();

  if (!supabase || input.orderIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('store_id', input.storeId)
    .in('order_id', input.orderIds)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as PaymentTransactionRow[]).map(mapPaymentTransaction);
}

export async function getLatestPaymentTransactionByOrderId(input: {
  storeId: string;
  orderId: string;
}): Promise<PaymentTransaction | null> {
  const transactions = await listPaymentTransactionsByOrderIds({
    storeId: input.storeId,
    orderIds: [input.orderId],
  });

  return transactions[0] ?? null;
}
