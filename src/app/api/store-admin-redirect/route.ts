import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import { normalizeHostname } from '@/modules/stores/host-resolution';
import { getStoreByCustomHostnameFromRepository } from '@/modules/stores/store.repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeAdminPath(value: string | null) {
  return value?.startsWith('/admin') && !value.startsWith('//')
    ? value
    : '/admin';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hostname = normalizeHostname(url.searchParams.get('host'));

  if (!hostname) {
    return NextResponse.json({ ok: false, error: 'domain_not_found' }, { status: 404 });
  }

  const resolved = await getStoreByCustomHostnameFromRepository(hostname);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'domain_not_found' }, { status: 404 });
  }

  const rootDomain = getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';
  const destination = new URL(
    safeAdminPath(url.searchParams.get('path')),
    `https://${resolved.store.slug}.${rootDomain}`
  );
  return NextResponse.redirect(destination, 308);
}
