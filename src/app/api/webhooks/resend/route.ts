import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getServerEnv } from '@/lib/env/server';
import {
  recordResendWebhookEvent,
  updateEmailMessageFromResendWebhook,
} from '@/modules/email/email.repository';
import type { EmailMessageStatus } from '@/modules/email/email.types';
import { captureOperationalException } from '@/modules/observability/monitoring.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toStatus(eventType: string): EmailMessageStatus | undefined {
  switch (eventType) {
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.suppressed':
      return 'suppressed';
    case 'email.sent':
      return 'sent';
    default:
      return undefined;
  }
}

function getMessageId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = (payload as { data?: unknown }).data;

  if (!data || typeof data !== 'object') return undefined;

  const value = (data as Record<string, unknown>).email_id;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();

  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'webhook_secret_not_configured' },
      { status: 501 }
    );
  }

  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ ok: false, error: 'missing_signature' }, { status: 400 });
  }

  const rawPayload = await request.text();
  const resend = new Resend(env.RESEND_API_KEY ?? 're_not_used_for_verification');
  let payload: { type?: unknown };

  try {
    payload = resend.webhooks.verify({
      payload: rawPayload,
      headers: { id, timestamp, signature },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    }) as { type?: unknown };
  } catch (error) {
    captureOperationalException({ error, area: 'webhook', code: 'resend_webhook_signature_invalid' });
    return NextResponse.json({ ok: false, error: 'invalid_webhook' }, { status: 401 });
  }

  try {
    const eventType = typeof payload.type === 'string' ? payload.type : 'unknown';
    const providerMessageId = getMessageId(payload);
    const event = await recordResendWebhookEvent({
      eventId: id,
      eventType,
      providerMessageId,
    });

    if (event.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const status = toStatus(eventType);

    if (status && providerMessageId) {
      await updateEmailMessageFromResendWebhook({
        providerMessageId,
        eventId: id,
        status,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureOperationalException({ error, area: 'webhook', code: 'resend_webhook_failed' });
    return NextResponse.json({ ok: false, error: 'webhook_processing_failed' }, { status: 503 });
  }
}
