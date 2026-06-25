import { NextRequest, NextResponse } from 'next/server';
import { checkStoreRole } from '@/modules/auth/auth.service';
import {
  MERCADO_PAGO_ADMIN_DETAIL_PATH,
  getMercadoPagoOAuthConfig,
} from '@/modules/integrations/mercado-pago/mercado-pago.config';
import {
  exchangeMercadoPagoAuthorizationCode,
  verifyMercadoPagoOAuthState,
} from '@/modules/integrations/mercado-pago/mercado-pago.oauth';
import {
  recordMercadoPagoConnectionError,
  saveMercadoPagoOAuthTokens,
} from '@/modules/integrations/mercado-pago/mercado-pago.account.service';
import type { MercadoPagoOAuthState } from '@/modules/integrations/mercado-pago/mercado-pago.types';

function redirectToDetail(origin: string, error?: string, state?: MercadoPagoOAuthState) {
  const url = new URL(state?.returnTo ?? MERCADO_PAGO_ADMIN_DETAIL_PATH, origin);

  if (error) {
    url.searchParams.set('error', error);
  } else if (state?.environment) {
    url.searchParams.set('connected', state.environment);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get('code');
  const stateValue = request.nextUrl.searchParams.get('state');
  const providerError = request.nextUrl.searchParams.get('error');
  const config = getMercadoPagoOAuthConfig();
  let state: MercadoPagoOAuthState | undefined;

  if (!stateValue) {
    return redirectToDetail(origin, 'invalid_state');
  }

  try {
    state = verifyMercadoPagoOAuthState(config, stateValue);
  } catch {
    return redirectToDetail(origin, 'invalid_state');
  }

  const role = await checkStoreRole(state.storeId, ['store_owner', 'store_admin']);

  if (!role.user) {
    return redirectToDetail(origin, 'missing_session', state);
  }

  if (!role.allowed) {
    await recordMercadoPagoConnectionError({
      storeId: state.storeId,
      environment: state.environment,
      errorCode: 'access_denied',
    });

    return redirectToDetail(origin, 'access_denied', state);
  }

  if (providerError) {
    await recordMercadoPagoConnectionError({
      storeId: state.storeId,
      environment: state.environment,
      errorCode: 'provider_denied_authorization',
    });

    return redirectToDetail(origin, 'provider_denied', state);
  }

  if (!code) {
    await recordMercadoPagoConnectionError({
      storeId: state.storeId,
      environment: state.environment,
      errorCode: 'missing_authorization_code',
    });

    return redirectToDetail(origin, 'missing_code', state);
  }

  if (!config.isConfigured) {
    await recordMercadoPagoConnectionError({
      storeId: state.storeId,
      environment: state.environment,
      errorCode: 'missing_oauth_config',
    });

    return redirectToDetail(origin, 'missing_config', state);
  }

  if (!config.isEncryptionConfigured) {
    await recordMercadoPagoConnectionError({
      storeId: state.storeId,
      environment: state.environment,
      errorCode: 'missing_encryption_config',
    });

    return redirectToDetail(origin, 'missing_encryption', state);
  }

  try {
    const tokens = await exchangeMercadoPagoAuthorizationCode({
      config,
      code,
      environment: state.environment,
    });

    await saveMercadoPagoOAuthTokens({
      storeId: state.storeId,
      environment: state.environment,
      tokens,
    });

    return redirectToDetail(origin, undefined, state);
  } catch {
    await recordMercadoPagoConnectionError({
      storeId: state.storeId,
      environment: state.environment,
      errorCode: 'oauth_callback_failed',
    });

    return redirectToDetail(origin, 'callback_failed', state);
  }
}
