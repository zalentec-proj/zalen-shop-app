import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { authorizeInternalJobRequest } from '@/modules/integrations/bling/jobs/bling-job-auth';
import {
  runBlingScheduledSync,
  type BlingScheduledSyncMode,
} from '@/modules/integrations/bling/jobs/bling-scheduled-sync.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSyncMode(value: string | null | undefined): BlingScheduledSyncMode {
  return value === 'full' ? 'full' : 'incremental';
}

async function getRequestMode(request: Request): Promise<BlingScheduledSyncMode> {
  const url = new URL(request.url);
  const queryMode = getSyncMode(url.searchParams.get('mode'));

  if (queryMode === 'full') {
    return queryMode;
  }

  try {
    const body = (await request.clone().json()) as { mode?: unknown };
    return getSyncMode(typeof body.mode === 'string' ? body.mode : undefined);
  } catch {
    return 'incremental';
  }
}

async function handle(request: Request) {
  const auth = authorizeInternalJobRequest(request);

  if (!auth.ok) {
    return NextResponse.json(
      { status: 'error', errorCode: auth.errorCode },
      { status: auth.status }
    );
  }

  const result = await runBlingScheduledSync({
    productSyncMode: await getRequestMode(request),
  });

  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/integracoes/bling');
  revalidatePath('/categoria/[slug]', 'page');
  revalidatePath('/produto/[slug]', 'page');

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
