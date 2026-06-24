import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import {
  createBlingWebhookEventInRepository,
  createBlingWebhookProcessJobInRepository,
} from '@/modules/integrations/bling/bling.repository';
import {
  isValidBlingWebhookSignature,
  parseBlingWebhookPayload,
} from '@/modules/integrations/bling/webhooks/bling-webhook.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const clientSecret = getServerEnv().BLING_CLIENT_SECRET;

  if (!clientSecret) {
    return NextResponse.json(
      { ok: false, error: 'webhook_secret_not_configured' },
      { status: 501 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-bling-signature-256');

  if (
    !isValidBlingWebhookSignature({
      rawBody,
      signature,
      clientSecret,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: 'invalid_webhook_signature' },
      { status: 401 }
    );
  }

  const parsed = parseBlingWebhookPayload(rawBody);

  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.errorCode },
      { status: 400 }
    );
  }

  try {
    const eventResult = await createBlingWebhookEventInRepository({
      storeId: ACTIVE_STORE_ID,
      eventId: parsed.eventId,
      eventType: parsed.event,
      payload: parsed.payload,
    });

    if (eventResult.duplicate) {
      return NextResponse.json({ ok: true, status: 'duplicate' });
    }

    if (!eventResult.webhookEventId) {
      return NextResponse.json(
        { ok: false, error: 'webhook_persistence_failed' },
        { status: 500 }
      );
    }

    const jobResult = await createBlingWebhookProcessJobInRepository({
      storeId: ACTIVE_STORE_ID,
      webhookEventId: eventResult.webhookEventId,
      eventId: parsed.eventId,
      eventType: parsed.event,
      externalIds: parsed.externalIds,
    });

    return NextResponse.json({
      ok: true,
      status: jobResult.duplicate ? 'duplicate' : 'queued',
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'webhook_persistence_failed' },
      { status: 500 }
    );
  }
}
