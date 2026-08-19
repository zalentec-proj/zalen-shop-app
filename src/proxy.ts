import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthCookieDomain } from '@/lib/auth/cookie-domain';
import {
  DEFAULT_LOCAL_STORE_ROOT_DOMAIN,
  getPlatformAppOriginFromHost,
  getRequestHost,
  getStoreSlugFromHostname,
  isLocalhostName,
  isReservedPlatformSubdomain,
  normalizeHostname,
} from '@/modules/stores/host-resolution';
import { activeStore } from '@/modules/stores/current-store';

const placeholderFragments = [
  '${',
  'seu-projeto',
  'sua-chave',
  'supabase_project_url',
  'supabase_publishable_key',
];

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  if (placeholderFragments.some((placeholder) => normalized.includes(placeholder))) {
    return undefined;
  }

  return normalized;
}

function getSafeNextPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/admin';
  }

  return value;
}

function isAllowedAppRedirectUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = normalizeHostname(url.host);
    const rootDomain =
      normalizeEnvValue(process.env.PLATFORM_ROOT_DOMAIN) ?? 'zalenshop.com.br';

    if (!url.pathname.startsWith('/admin')) {
      return false;
    }

    return (
      isLocalhostName(hostname) ||
      hostname === `app.${rootDomain}`
    );
  } catch {
    return false;
  }
}

function getSafeNextTarget(value: string | null): string {
  if (!value) {
    return '/admin';
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return getSafeNextPath(value);
  }

  return isAllowedAppRedirectUrl(value) ? value : '/admin';
}

function getRequestOrigin(request: NextRequest) {
  const host = getRequestHost(request.headers, request.nextUrl.host);
  const protocol =
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(':', '') ??
    'http';

  return `${protocol}://${host}`;
}

function shouldResolveCustomAdminHost(
  request: NextRequest,
  rootDomain: string
) {
  const hostname = normalizeHostname(
    getRequestHost(request.headers, request.nextUrl.host)
  );

  if (!hostname || isLocalhostName(hostname)) {
    return false;
  }

  if (hostname.endsWith(`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`)) {
    return false;
  }

  const slug = getStoreSlugFromHostname(hostname, rootDomain);
  if (slug && !isReservedPlatformSubdomain(slug)) return false;

  return hostname !== rootDomain && !hostname.endsWith(`.${rootDomain}`);
}

function shouldRedirectPlatformAdminToStoreHost(
  request: NextRequest,
  rootDomain: string
) {
  const hostname = normalizeHostname(
    getRequestHost(request.headers, request.nextUrl.host)
  );

  return Boolean(
    hostname &&
      !isLocalhostName(hostname) &&
      (hostname === rootDomain || hostname === `app.${rootDomain}`)
  );
}

function getActiveStoreAdminOrigin(request: NextRequest, rootDomain: string) {
  const requestOrigin = new URL(getRequestOrigin(request));
  const hostname = normalizeHostname(requestOrigin.host);
  const port = requestOrigin.port ? `:${requestOrigin.port}` : '';

  if (hostname?.endsWith(`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`)) {
    return `${requestOrigin.protocol}//${activeStore.slug}.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}${port}`;
  }

  return `${requestOrigin.protocol}//${activeStore.slug}.${rootDomain}`;
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  destination: string | URL,
  searchParams?: Record<string, string>
) {
  const redirectUrl =
    destination instanceof URL
      ? destination
      : new URL(destination, request.nextUrl.origin);

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    redirectUrl.searchParams.set(key, value);
  });

  const redirectResponse = NextResponse.redirect(redirectUrl);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    'x-zalen-request-path',
    `${pathname}${request.nextUrl.search}`
  );
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const rootDomain =
    normalizeEnvValue(process.env.PLATFORM_ROOT_DOMAIN) ?? 'zalenshop.com.br';

  if (
    pathname.startsWith('/admin') &&
    shouldRedirectPlatformAdminToStoreHost(request, rootDomain)
  ) {
    return NextResponse.redirect(
      new URL(
        `${pathname}${request.nextUrl.search}`,
        getActiveStoreAdminOrigin(request, rootDomain)
      )
    );
  }

  if (pathname.startsWith('/admin') && shouldResolveCustomAdminHost(request, rootDomain)) {
    const hostname = normalizeHostname(
      getRequestHost(request.headers, request.nextUrl.host)
    );
    const resolverUrl = new URL(
      '/api/store-admin-redirect',
      getPlatformAppOriginFromHost(new URL(getRequestOrigin(request)), rootDomain)
    );
    resolverUrl.searchParams.set('host', hostname ?? '');
    resolverUrl.searchParams.set(
      'path',
      getSafeNextPath(`${pathname}${request.nextUrl.search}`)
    );

    return NextResponse.redirect(resolverUrl);
  }

  const isAuthRoute = pathname === '/login' || pathname === '/login/forgot';
  if (!pathname.startsWith('/admin') && !isAuthRoute) {
    return response;
  }

  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = normalizeEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const cookieDomain = getAuthCookieDomain(
    getRequestHost(request.headers, request.nextUrl.host)
  );
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    ...(cookieDomain ? { cookieOptions: { domain: cookieDomain } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        requestHeaders.set('cookie', request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname.startsWith('/admin') && !user) {
    const requestOrigin = getRequestOrigin(request);
    const loginUrl = new URL(
      '/login',
      getPlatformAppOriginFromHost(new URL(requestOrigin), rootDomain)
    );
    loginUrl.searchParams.set('next', getSafeNextPath(`${pathname}${request.nextUrl.search}`));

    return redirectWithCookies(request, response, loginUrl);
  }

  if ((pathname === '/login' || pathname === '/login/forgot') && user) {
    return redirectWithCookies(
      request,
      response,
      getSafeNextTarget(request.nextUrl.searchParams.get('next'))
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};
