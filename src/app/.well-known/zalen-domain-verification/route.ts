import { NextResponse } from 'next/server';
import { getStoreDomainByHostname } from '@/modules/domains/domain.repository';
import { normalizeHostname } from '@/modules/stores/host-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    url.host;
  const hostname = normalizeHostname(host);
  const requestedConfiguration = url.searchParams.get('configuration');
  const domain = hostname
    ? await getStoreDomainByHostname(hostname).catch(() => null)
    : null;

  if (
    !domain ||
    !requestedConfiguration ||
    requestedConfiguration !== domain.configurationId
  ) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, configurationId: domain.configurationId },
    { headers: { 'cache-control': 'no-store' } }
  );
}
