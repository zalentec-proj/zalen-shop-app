import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import { verifyDueCustomDomains } from '@/modules/domains/domain.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = getServerEnv().CRON_SECRET ?? getServerEnv().INTERNAL_JOB_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await verifyDueCustomDomains();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
