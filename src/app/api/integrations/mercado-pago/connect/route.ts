import { NextResponse } from 'next/server';
import { checkStoreRole } from '@/modules/auth/auth.service';
import {
  MERCADO_PAGO_ADMIN_DETAIL_PATH,
  getMercadoPagoOAuthConfig,
  parseMercadoPagoEnvironment,
} from '@/modules/integrations/mercado-pago/mercado-pago.config';
import {
  buildMercadoPagoAuthorizationUrl,
  createMercadoPagoOAuthState,
} from '@/modules/integrations/mercado-pago/mercado-pago.oauth';
import {
  recordMercadoPagoConnectionAttempt,
  recordMercadoPagoConnectionError,
} from '@/modules/integrations/mercado-pago/mercado-pago.account.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

function redirectToDetail(origin: string, error?: string) {
  const url = new URL(MERCADO_PAGO_ADMIN_DETAIL_PATH, origin);

  if (error) {
    url.searchParams.set('error', error);
  }

  return NextResponse.redirect(url);
}

function getReturnTo(requestUrl: URL) {
  const returnTo = requestUrl.searchParams.get('return_to');

  return returnTo?.startsWith('/admin/')
    ? returnTo
    : MERCADO_PAGO_ADMIN_DETAIL_PATH;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const environment = parseMercadoPagoEnvironment(
    requestUrl.searchParams.get('environment')
  );
  const store = await resolveCurrentStoreFromRequest(request);

  if (!environment) {
    return redirectToDetail(origin, 'invalid_environment');
  }

  const role = await checkStoreRole(store.id, ['store_owner', 'store_admin']);

  if (!role.user) {
    return NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent(MERCADO_PAGO_ADMIN_DETAIL_PATH)}`,
        origin
      )
    );
  }

  if (!role.allowed) {
    return redirectToDetail(origin, 'access_denied');
  }

  const config = getMercadoPagoOAuthConfig();

  if (!config.isConfigured) {
    await recordMercadoPagoConnectionError({
      storeId: store.id,
      environment,
      errorCode: 'missing_oauth_config',
    });

    return redirectToDetail(origin, 'missing_config');
  }

  if (!config.isEncryptionConfigured) {
    await recordMercadoPagoConnectionError({
      storeId: store.id,
      environment,
      errorCode: 'missing_encryption_config',
    });

    return redirectToDetail(origin, 'missing_encryption');
  }

  const state = createMercadoPagoOAuthState({
    config,
    storeId: store.id,
    environment,
    returnTo: getReturnTo(requestUrl),
  });
  const authorizationUrl = buildMercadoPagoAuthorizationUrl({
    config,
    state,
  });

  await recordMercadoPagoConnectionAttempt({
    storeId: store.id,
    environment,
    userId: role.user.id,
  });

  return NextResponse.redirect(authorizationUrl);
}
