import { NextResponse } from 'next/server';
import { processEvolutionWebhook } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function POST(request: Request) {
  const body = object(await request.json().catch(() => null));
  const instanceName = typeof body.instance === 'string' ? body.instance : typeof body.instanceName === 'string' ? body.instanceName : undefined;
  const eventType = typeof body.event === 'string' ? body.event : typeof body.eventType === 'string' ? body.eventType : 'UNKNOWN';
  const eventId = typeof body.id === 'string' ? body.id : undefined;
  if (!instanceName) return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  const result = await processEvolutionWebhook({
    instanceName,
    suppliedSecret: request.headers.get('x-zalen-webhook-secret'),
    eventType,
    eventId,
    payload: body,
  });
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: result.errorCode }, { status: 401 });
}
