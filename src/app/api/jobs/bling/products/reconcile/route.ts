import { NextResponse } from 'next/server';
import { authorizeInternalJobRequest } from '@/modules/integrations/bling/jobs/bling-job-auth';
import { revalidateBlingCatalogPaths } from '@/modules/integrations/bling/jobs/bling-cache-revalidation';
import { runBlingScheduledProductReconciliation } from '@/modules/integrations/bling/jobs/bling-scheduled-product-reconciliation.service';

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

  const result = await runBlingScheduledProductReconciliation();

  if (result.changesApplied > 0) {
    revalidateBlingCatalogPaths();
  }

  return NextResponse.json(result, {
    status: result.status === 'success' ? 200 : 500,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
