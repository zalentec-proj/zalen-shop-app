import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import { captureOperationalException } from '@/modules/observability/monitoring.service';
import { processMercadoPagoPaymentUpdate } from '@/modules/payments/mercado-pago-payment.service';
import {
  listPendingPaymentAttempts,
  updatePaymentAttempt,
} from '@/modules/payments/payment-attempt.repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = getServerEnv().CRON_SECRET ?? getServerEnv().INTERNAL_JOB_SECRET;

  return Boolean(
    secret && request.headers.get('authorization') === `Bearer ${secret}`
  );
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const attempts = await listPendingPaymentAttempts({ limit: 100 });
  let processed = 0;
  let failed = 0;

  for (const attempt of attempts) {
    if (!attempt.externalPaymentId) continue;

    const result = await processMercadoPagoPaymentUpdate({
      storeId: attempt.storeId,
      paymentId: attempt.externalPaymentId,
      environment: attempt.environment,
      source: 'webhook',
    });

    if (!result.ok) {
      failed += 1;
      await updatePaymentAttempt({
        attemptId: attempt.id,
        storeId: attempt.storeId,
        externalPaymentId: attempt.externalPaymentId,
        paymentMethodId: attempt.paymentMethodId,
        paymentTypeId: attempt.paymentTypeId,
        status: 'error',
        lastError: result.errorCode,
      }).catch((error) => {
        captureOperationalException({
          error,
          area: 'payment',
          storeId: attempt.storeId,
          code: 'payment_reconcile_attempt_update_failed',
        });
      });
      continue;
    }

    processed += 1;
    await updatePaymentAttempt({
      attemptId: attempt.id,
      storeId: attempt.storeId,
      externalPaymentId: attempt.externalPaymentId,
      paymentMethodId: attempt.paymentMethodId,
      paymentTypeId: attempt.paymentTypeId,
      status: result.status,
    });
  }

  return NextResponse.json({ ok: true, processed, failed });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
