import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  searchParams?: Record<string, string>
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = '';

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
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = normalizeEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
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
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/admin') && !user) {
    return redirectWithCookies(request, response, '/login', {
      next: getSafeNextPath(`${pathname}${request.nextUrl.search}`),
    });
  }

  if ((pathname === '/login' || pathname === '/login/forgot') && user) {
    return redirectWithCookies(request, response, '/admin');
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/login/forgot'],
};
