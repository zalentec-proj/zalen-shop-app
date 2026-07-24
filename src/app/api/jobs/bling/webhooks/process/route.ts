import { NextResponse } from 'next/server';
import { authorizeInternalJobRequest } from '@/modules/integrations/bling/jobs/bling-job-auth';
import { revalidateBlingCatalogPaths } from '@/modules/integrations/bling/jobs/bling-cache-revalidation';
import { processBlingWebhookJobsForConnectedStores } from '@/modules/integrations/bling/webhooks/bling-webhook-processor.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  const auth = authorizeInternalJobRequest(request);

  if (!auth.ok) {
    return NextResponse.json(
      { status: 'error', errorCode: auth.errorCode },
      { status: auth.status }
    );
  }

  const result = await processBlingWebhookJobsForConnectedStores({
    limitPerStore: 20,
  });

  if (result.changesApplied > 0) {
    revalidateBlingCatalogPaths();
  }

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
