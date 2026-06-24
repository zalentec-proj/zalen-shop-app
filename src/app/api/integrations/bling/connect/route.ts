import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { getBlingOAuthConfig } from '@/modules/integrations/bling/bling.config';
import { buildBlingAuthorizationUrl } from '@/modules/integrations/bling/bling.oauth';
import {
  recordBlingConnectionAttempt,
  recordBlingConnectionError,
} from '@/modules/integrations/bling/bling.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

const stateCookieName = 'zalen_bling_oauth_state';
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
  const user = await getCurrentUser();
  const store = await resolveCurrentStoreFromRequest(request);

  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(detailPath)}`, origin)
    );
  }

  if (!(await canAccessStore(user.id, store.id))) {
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
    userId: user.id,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(stateCookieName, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
