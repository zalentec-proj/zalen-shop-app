import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthCookieDomain } from '@/lib/auth/cookie-domain';
import {
  DEFAULT_LOCAL_STORE_ROOT_DOMAIN,
  getPlatformAppOriginFromHost,
  isLocalhostName,
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
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host;
  const protocol =
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(':', '') ??
    'http';

  return `${protocol}://${host}`;
}

function shouldRedirectAdminToStoreHost(
  request: NextRequest,
  rootDomain: string
) {
  const hostname = normalizeHostname(
    request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      request.nextUrl.host
  );

  if (!hostname || isLocalhostName(hostname)) {
    return false;
  }

  if (hostname.endsWith(`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`)) {
    return false;
  }

  return hostname !== `${activeStore.slug}.${rootDomain}`;
}

function getStoreAdminOriginFromHost(
  currentUrl: URL,
  rootDomain: string
) {
  const hostname = normalizeHostname(currentUrl.host);

  if (
    !hostname ||
    isLocalhostName(hostname) ||
    hostname.endsWith(`.${DEFAULT_LOCAL_STORE_ROOT_DOMAIN}`)
  ) {
    return currentUrl.origin;
  }

  return `${currentUrl.protocol}//${activeStore.slug}.${rootDomain}`;
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
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const rootDomain =
    normalizeEnvValue(process.env.PLATFORM_ROOT_DOMAIN) ?? 'zalenshop.com.br';

  if (pathname.startsWith('/admin') && shouldRedirectAdminToStoreHost(request, rootDomain)) {
    const requestOrigin = new URL(getRequestOrigin(request));
    const storeAdminUrl = new URL(
      `${pathname}${request.nextUrl.search}`,
      getStoreAdminOriginFromHost(requestOrigin, rootDomain)
    );

    return NextResponse.redirect(storeAdminUrl);
  }

  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = normalizeEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const cookieDomain = getAuthCookieDomain();
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

        response = NextResponse.next({ request });

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
  matcher: ['/admin/:path*', '/login', '/login/forgot'],
};
