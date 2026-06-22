import { NextRequest, NextResponse } from 'next/server';
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import { getServerEnv } from '@/lib/env/server';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { processMercadoPagoPaymentUpdate } from '@/modules/payments/mercado-pago-payment.service';

function getWebhookDataId(request: NextRequest, body: unknown) {
  const queryDataId =
    request.nextUrl.searchParams.get('data.id') ??
    request.nextUrl.searchParams.get('id');

  if (queryDataId) {
    return queryDataId;
  }

  if (
    body &&
    typeof body === 'object' &&
    'data' in body &&
    body.data &&
    typeof body.data === 'object' &&
    'id' in body.data &&
    typeof body.data.id === 'string'
  ) {
    return body.data.id;
  }

  return undefined;
}

function getWebhookEventType(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  if ('type' in body && typeof body.type === 'string') {
    return body.type;
  }

  if ('action' in body && typeof body.action === 'string') {
    return body.action;
  }

  return undefined;
}

function isPaymentWebhookEvent(request: NextRequest, body: unknown) {
  const queryType =
    request.nextUrl.searchParams.get('type') ??
    request.nextUrl.searchParams.get('topic');
  const eventType = getWebhookEventType(body);

  return (
    queryType === 'payment' ||
    eventType === 'payment' ||
    eventType?.startsWith('payment.') === true
  );
}

function toWebhookErrorMessage(errorCode: string | undefined) {
  return errorCode?.slice(0, 220) ?? 'payment_update_failed';
}

export async function POST(request: NextRequest) {
  const secret = getServerEnv().MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'webhook_secret_not_configured' },
      { status: 501 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_webhook_payload' },
      { status: 400 }
    );
  }

  const dataId = getWebhookDataId(request, body);

  try {
    WebhookSignatureValidator.validate({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId,
      secret,
      toleranceSeconds: 300,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return NextResponse.json(
        { ok: false, error: 'invalid_webhook_signature' },
        { status: 401 }
      );
    }

    throw error;
  }

  const supabase = createOptionalAdminClient();

  let webhookEventId: string | undefined;

  if (supabase) {
    const { data } = await supabase
      .from('webhook_events')
      .insert({
        store_id: ACTIVE_STORE_ID,
        provider: 'mercado_pago',
        event_type: getWebhookEventType(body),
        external_id: dataId,
        signature_valid: true,
        payload: body,
        status: 'received',
      })
      .select('id')
      .single();

    webhookEventId = data?.id;
  }

  if (dataId && isPaymentWebhookEvent(request, body)) {
    const result = await processMercadoPagoPaymentUpdate({
      storeId: ACTIVE_STORE_ID,
      paymentId: dataId,
      source: 'webhook',
    }).catch(() => ({
      ok: false,
      errorCode: 'payment_webhook_processing_failed',
    }));

    if (supabase && webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({
          status: result.ok ? 'processed' : 'error',
          processed_at: new Date().toISOString(),
          error_message: result.ok
            ? null
            : toWebhookErrorMessage(result.errorCode),
        })
        .eq('id', webhookEventId)
        .eq('store_id', ACTIVE_STORE_ID);
    }
  }

  return NextResponse.json({ ok: true });
}
