import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  checkStoreRole,
  storeManagementRoles,
} from '@/modules/auth/auth.service';
import { getBlingOAuthConfig } from '@/modules/integrations/bling/bling.config';
import { buildBlingAuthorizationUrl } from '@/modules/integrations/bling/bling.oauth';
import {
  BLING_OAUTH_STATE_COOKIE_NAME,
  getBlingOAuthStateCookieOptions,
} from '@/modules/integrations/bling/bling.oauth-state-cookie';
import {
  recordBlingConnectionAttempt,
  recordBlingConnectionError,
} from '@/modules/integrations/bling/bling.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

const detailPath = '/admin/integracoes/bling';

function redirectToDetail(origin: string, error?: string) {
  const url = new URL(detailPath, origin);

  if (error) {
    url.searchParams.set('error', error);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const store = await resolveCurrentStoreFromRequest(request);
  const access = await checkStoreRole(store.id, storeManagementRoles);

  if (!access.user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(detailPath)}`, origin)
    );
  }

  if (!access.allowed) {
    return redirectToDetail(origin, 'access_denied');
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

  const state = randomBytes(32).toString('base64url');
  const authorizationUrl = buildBlingAuthorizationUrl(config, state);

  await recordBlingConnectionAttempt({
    storeId: store.id,
    userId: access.user.id,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    BLING_OAUTH_STATE_COOKIE_NAME,
    state,
    getBlingOAuthStateCookieOptions(60 * 10)
  );

  return response;
}
