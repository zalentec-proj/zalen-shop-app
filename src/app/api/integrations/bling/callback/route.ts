import { NextRequest, NextResponse } from 'next/server';
import {
  checkStoreRole,
  storeManagementRoles,
} from '@/modules/auth/auth.service';
import { getBlingOAuthConfig } from '@/modules/integrations/bling/bling.config';
import { exchangeBlingAuthorizationCode } from '@/modules/integrations/bling/bling.oauth';
import { getStoreSlugFromBlingOAuthState } from '@/modules/integrations/bling/bling.oauth-state';
import {
  BLING_OAUTH_STATE_COOKIE_NAME,
  getBlingOAuthStateCookieOptions,
} from '@/modules/integrations/bling/bling.oauth-state-cookie';
import {
  recordBlingConnectionError,
  saveBlingOAuthTokens,
} from '@/modules/integrations/bling/bling.service';
import { getServerEnv } from '@/lib/env/server';
import { getStorefrontOriginFromHost } from '@/modules/stores/host-resolution';
import { getStoreBySlugFromRepository } from '@/modules/stores/store.repository';

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

  if (!state || !expectedState || state !== expectedState) {
    return redirectToDetail(origin, 'invalid_state');
  }

  const storeSlug = getStoreSlugFromBlingOAuthState(state);
  const store = storeSlug
    ? await getStoreBySlugFromRepository(storeSlug)
    : null;

  if (!store || store.status !== 'active') {
    return redirectToDetail(origin, 'invalid_state');
  }

  const detailOrigin = getStorefrontOriginFromHost(
    request.nextUrl,
    store.slug,
    getServerEnv().PLATFORM_ROOT_DOMAIN
  );
  const access = await checkStoreRole(store.id, storeManagementRoles);

  if (!access.user) {
    return redirectToDetail(detailOrigin, 'missing_session');
  }

  if (!access.allowed) {
    return redirectToDetail(detailOrigin, 'access_denied');
  }

  if (providerError) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'provider_denied_authorization',
    });

    return redirectToDetail(detailOrigin, 'provider_denied');
  }

  if (!code) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'invalid_oauth_state',
    });

    return redirectToDetail(detailOrigin, 'invalid_state');
  }

  const config = getBlingOAuthConfig();

  if (!config.isConfigured) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'missing_oauth_config',
    });

    return redirectToDetail(detailOrigin, 'missing_config');
  }

  if (!config.isEncryptionConfigured) {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'missing_encryption_config',
    });

    return redirectToDetail(detailOrigin, 'missing_encryption');
  }

  try {
    const tokens = await exchangeBlingAuthorizationCode(config, code);
    await saveBlingOAuthTokens({
      storeId: store.id,
      tokens,
    });

    return redirectToDetail(detailOrigin);
  } catch {
    await recordBlingConnectionError({
      storeId: store.id,
      errorCode: 'oauth_callback_failed',
    });

    return redirectToDetail(detailOrigin, 'callback_failed');
  }
}
