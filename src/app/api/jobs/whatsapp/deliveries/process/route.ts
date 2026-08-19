import { NextResponse } from 'next/server';
import { authorizeInternalJobRequest } from '@/modules/integrations/bling/jobs/bling-job-auth';
import { processDueWhatsAppDeliveries } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service';
import { captureOperationalException } from '@/modules/observability/monitoring.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  const authorization = authorizeInternalJobRequest(request);
  if (!authorization.ok) return NextResponse.json({ ok: false, error: authorization.errorCode }, { status: authorization.status });
  try {
    return NextResponse.json({ ok: true, ...(await processDueWhatsAppDeliveries()) });
  } catch (error) {
    captureOperationalException({ error, area: 'webhook', code: 'whatsapp_delivery_job_failed' });
    return NextResponse.json({ ok: false, error: 'whatsapp_delivery_job_failed' }, { status: 500 });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
