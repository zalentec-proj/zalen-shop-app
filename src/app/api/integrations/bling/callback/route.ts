import { NextRequest, NextResponse } from 'next/server';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { getBlingOAuthConfig } from '@/modules/integrations/bling/bling.config';
import { exchangeBlingAuthorizationCode } from '@/modules/integrations/bling/bling.oauth';
import {
  BLING_OAUTH_STATE_COOKIE_NAME,
  getBlingOAuthStateCookieOptions,
} from '@/modules/integrations/bling/bling.oauth-state-cookie';
import {
  recordBlingConnectionError,
  saveBlingOAuthTokens,
} from '@/modules/integrations/bling/bling.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

const detailPath = '/admin/integracoes/bling';

function redirectToDetail(origin: string, error?: string) {
  const url = new URL(detailPath, origin);

  if (error) {
    url.searchParams.set('error', error);
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(
    BLING_OAUTH_STATE_COOKIE_NAME,
    '',
    getBlingOAuthStateCookieOptions(0)
  );

  return response;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const providerError = request.nextUrl.searchParams.get('error');
  const expectedState = request.cookies.get(BLING_OAUTH_STATE_COOKIE_NAME)?.value;
  const user = await getCurrentUser();
  const store = await resolveCurrentStoreFromRequest(request);

  if (!user) {
    return redirectToDetail(origin, 'missing_session');
  }

  if (!(await canAccessStore(user.id, store.id))) {
    return redirectToDetail(origin, 'access_denied');
  }

  if (providerError) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'provider_denied_authorization',
    });

    return redirectToDetail(origin, 'provider_denied');
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'invalid_oauth_state',
    });

    return redirectToDetail(origin, 'invalid_state');
  }

  const config = getBlingOAuthConfig();

  if (!config.isConfigured) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'missing_oauth_config',
    });

    return redirectToDetail(origin, 'missing_config');
  }

  if (!config.isEncryptionConfigured) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'missing_encryption_config',
    });

    return redirectToDetail(origin, 'missing_encryption');
  }

  try {
    const tokens = await exchangeBlingAuthorizationCode(config, code);
    await saveBlingOAuthTokens({
      storeId: store.id,
      tokens,
    });

    return redirectToDetail(origin);
  } catch {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'oauth_callback_failed',
    });

    return redirectToDetail(origin, 'callback_failed');
  }
}
