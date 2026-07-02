import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { authorizeInternalJobRequest } from '@/modules/integrations/bling/jobs/bling-job-auth';
import { runBlingScheduledSync } from '@/modules/integrations/bling/jobs/bling-scheduled-sync.service';

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

  const result = await runBlingScheduledSync();

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
