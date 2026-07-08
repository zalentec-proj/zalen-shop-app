import 'server-only';

import { getAuthCookieDomain } from '@/lib/auth/cookie-domain';

export const BLING_OAUTH_STATE_COOKIE_NAME = 'zalen_bling_oauth_state';

export function getBlingOAuthStateCookieOptions(maxAge: number) {
  const domain = getAuthCookieDomain();

  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
  };
}
