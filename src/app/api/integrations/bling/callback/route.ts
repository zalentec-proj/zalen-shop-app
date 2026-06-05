import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { getBlingOAuthConfig } from '@/modules/integrations/bling/bling.config';
import { exchangeBlingAuthorizationCode } from '@/modules/integrations/bling/bling.oauth';
import {
  recordBlingConnectionError,
  saveBlingOAuthTokens,
} from '@/modules/integrations/bling/bling.service';

const stateCookieName = 'zalen_bling_oauth_state';
const detailPath = '/admin/integracoes/bling';

function redirectToDetail(origin: string, error?: string) {
  const url = new URL(detailPath, origin);

  if (error) {
    url.searchParams.set('error', error);
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(stateCookieName, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const providerError = request.nextUrl.searchParams.get('error');
  const expectedState = request.cookies.get(stateCookieName)?.value;
  const user = await getCurrentUser();

  if (!user) {
    return redirectToDetail(origin, 'missing_session');
  }

  if (!(await canAccessStore(user.id, ACTIVE_STORE_ID))) {
    return redirectToDetail(origin, 'access_denied');
  }

  if (providerError) {
    await recordBlingConnectionError({
      storeId: ACTIVE_STORE_ID,
      errorCode: 'provider_denied_authorization',
    });

    return redirectToDetail(origin, 'provider_denied');
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    await recordBlingConnectionError({
      storeId: ACTIVE_STORE_ID,
      errorCode: 'invalid_oauth_state',
    });

    return redirectToDetail(origin, 'invalid_state');
  }

  const config = getBlingOAuthConfig();

  if (!config.isConfigured) {
    await recordBlingConnectionError({
      storeId: ACTIVE_STORE_ID,
      errorCode: 'missing_oauth_config',
    });

    return redirectToDetail(origin, 'missing_config');
  }

  if (!config.isEncryptionConfigured) {
    await recordBlingConnectionError({
      storeId: ACTIVE_STORE_ID,
      errorCode: 'missing_encryption_config',
    });

    return redirectToDetail(origin, 'missing_encryption');
  }

  try {
    const tokens = await exchangeBlingAuthorizationCode(config, code);
    await saveBlingOAuthTokens({
      storeId: ACTIVE_STORE_ID,
      tokens,
    });

    return redirectToDetail(origin);
  } catch {
    await recordBlingConnectionError({
      storeId: ACTIVE_STORE_ID,
      errorCode: 'oauth_callback_failed',
    });

    return redirectToDetail(origin, 'callback_failed');
  }
}
