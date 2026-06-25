import { NextRequest, NextResponse } from 'next/server';
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import { processMercadoPagoPaymentUpdate } from '@/modules/payments/mercado-pago-payment.service';
import {
  getMercadoPagoWebhookSecret,
  parseMercadoPagoEnvironment,
} from '@/modules/integrations/mercado-pago/mercado-pago.config';
import type { MercadoPagoEnvironment } from '@/modules/integrations/mercado-pago/mercado-pago.types';

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

function toWebhookRecord(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }

  return body as Record<string, unknown>;
}

function getWebhookNotificationId(
  request: NextRequest,
  body: unknown,
  dataId: string | undefined
) {
  const record = toWebhookRecord(body);
  const bodyId = record?.id;
  const requestId = request.headers.get('x-request-id');
  const eventType = getWebhookEventType(body);

  if (typeof bodyId === 'string' && bodyId.trim()) {
    return `notification:${bodyId.trim()}`;
  }

  if (typeof bodyId === 'number') {
    return `notification:${bodyId}`;
  }

  if (requestId) {
    return `request:${requestId}`;
  }

  if (dataId && eventType) {
    return `payment:${dataId}:${eventType}`;
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

function shouldRetryWebhook(errorCode: string | undefined) {
  if (!errorCode) {
    return true;
  }

  return (
    errorCode === 'mercado_pago_not_configured' ||
    errorCode === 'payment_webhook_processing_failed' ||
    errorCode.startsWith('mercado_pago_lookup_failed')
  );
}

function getWebhookContext(request: NextRequest): {
  storeId?: string;
  environment?: MercadoPagoEnvironment;
} {
  const storeId = request.nextUrl.searchParams.get('store_id') ?? undefined;
  const environment = parseMercadoPagoEnvironment(
    request.nextUrl.searchParams.get('environment')
  );

  return {
    storeId,
    environment: environment ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  const context = getWebhookContext(request);

  if (!context.storeId) {
    return NextResponse.json(
      { ok: false, error: 'missing_store_id' },
      { status: 400 }
    );
  }

  if (!context.environment) {
    return NextResponse.json(
      { ok: false, error: 'missing_environment' },
      { status: 400 }
    );
  }

  const secret = getMercadoPagoWebhookSecret(context.environment);

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

  if (!dataId) {
    return NextResponse.json(
      { ok: false, error: 'missing_payment_id' },
      { status: 400 }
    );
  }

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
  const eventType = getWebhookEventType(body);
  const notificationId = getWebhookNotificationId(request, body, dataId);

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'webhook_event_persistence_unavailable' },
      { status: 503 }
    );
  }

  let webhookEventId: string | undefined;
  let webhookAlreadyProcessed = false;

  const { data, error } = await supabase
    .from('webhook_events')
    .insert({
      store_id: context.storeId,
      provider: 'mercado_pago',
      event_type: eventType,
      external_id: notificationId,
      signature_valid: true,
      payload: {
        notification: body,
        paymentId: dataId,
        environment: context.environment,
        requestId: request.headers.get('x-request-id'),
      },
      status: 'received',
    })
    .select('id')
    .single();

  if (error?.code === '23505' && notificationId) {
    const { data: existingEvent, error: existingEventError } = await supabase
      .from('webhook_events')
      .select('id,status')
      .eq('store_id', context.storeId)
      .eq('provider', 'mercado_pago')
      .eq('external_id', notificationId)
      .maybeSingle();

    if (existingEventError || !existingEvent) {
      return NextResponse.json(
        { ok: false, error: 'webhook_event_lookup_failed' },
        { status: 503 }
      );
    }

    webhookEventId = existingEvent.id as string;
    webhookAlreadyProcessed = existingEvent.status === 'processed';
  } else if (error) {
    return NextResponse.json(
      { ok: false, error: 'webhook_event_persistence_failed' },
      { status: 503 }
    );
  } else {
    webhookEventId = data?.id;
  }

  if (!webhookEventId) {
    return NextResponse.json(
      { ok: false, error: 'webhook_event_id_missing' },
      { status: 503 }
    );
  }

  if (webhookAlreadyProcessed) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (dataId && isPaymentWebhookEvent(request, body)) {
    const result = await processMercadoPagoPaymentUpdate({
      storeId: context.storeId,
      paymentId: dataId,
      environment: context.environment,
      source: 'webhook',
    }).catch(() => ({
      ok: false,
      status: 'error' as const,
      errorCode: 'payment_webhook_processing_failed',
    }));

    const { error: updateError } = await supabase
      .from('webhook_events')
      .update({
        status: result.ok ? 'processed' : 'error',
        processed_at: new Date().toISOString(),
        error_message: result.ok
          ? null
          : toWebhookErrorMessage(result.errorCode),
      })
      .eq('id', webhookEventId)
      .eq('store_id', context.storeId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: 'webhook_event_update_failed' },
        { status: 503 }
      );
    }

    if (!result.ok && shouldRetryWebhook(result.errorCode)) {
      return NextResponse.json(
        { ok: false, error: toWebhookErrorMessage(result.errorCode) },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      error: result.ok ? undefined : toWebhookErrorMessage(result.errorCode),
    });
  }

  const { error: updateError } = await supabase
    .from('webhook_events')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', webhookEventId)
    .eq('store_id', context.storeId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: 'webhook_event_update_failed' },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
