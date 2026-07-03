'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkStoreRole } from '@/modules/auth/auth.service';
import {
  MERCADO_PAGO_ADMIN_DETAIL_PATH,
  parseMercadoPagoEnvironment,
} from '@/modules/integrations/mercado-pago/mercado-pago.config';
import { getMercadoPagoAccessContext } from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import {
  disconnectMercadoPagoIntegration,
  setMercadoPagoActiveEnvironment,
} from '@/modules/integrations/mercado-pago/mercado-pago.account.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

function redirectWithParam(
  key: 'error' | 'tested' | 'disconnected' | 'activated',
  value: string
): never {
  redirect(`${MERCADO_PAGO_ADMIN_DETAIL_PATH}?${key}=${encodeURIComponent(value)}`);
}

async function assertCanManageMercadoPago() {
  const store = await resolveCurrentStoreFromHeaders();
  const role = await checkStoreRole(store.id, ['store_owner', 'store_admin']);

  if (!role.user) {
    redirect(
      `/login?next=${encodeURIComponent(MERCADO_PAGO_ADMIN_DETAIL_PATH)}`
    );
  }

  if (!role.allowed) {
    redirectWithParam('error', 'access_denied');
  }

  return { store, user: role.user };
}

function getEnvironment(formData: FormData) {
  return parseMercadoPagoEnvironment(String(formData.get('environment') ?? ''));
}

export async function testMercadoPagoConnectionAction(formData: FormData) {
  const environment = getEnvironment(formData);

  if (!environment) {
    redirectWithParam('error', 'invalid_environment');
  }

  const { store } = await assertCanManageMercadoPago();

  try {
    await getMercadoPagoAccessContext({
      storeId: store.id,
      environment,
    });
  } catch {
    redirectWithParam('error', `test_failed_${environment}`);
  }

  revalidatePath(MERCADO_PAGO_ADMIN_DETAIL_PATH);
  redirectWithParam('tested', environment);
}

export async function disconnectMercadoPagoAction(formData: FormData) {
  const environment = getEnvironment(formData);

  if (!environment) {
    redirectWithParam('error', 'invalid_environment');
  }

  const { store } = await assertCanManageMercadoPago();

  await disconnectMercadoPagoIntegration({
    storeId: store.id,
    environment,
  });

  revalidatePath(MERCADO_PAGO_ADMIN_DETAIL_PATH);
  redirectWithParam('disconnected', environment);
}

export async function setMercadoPagoActiveEnvironmentAction(formData: FormData) {
  const environment = getEnvironment(formData);

  if (!environment) {
    redirectWithParam('error', 'invalid_environment');
  }

  const { store, user } = await assertCanManageMercadoPago();

  try {
    await setMercadoPagoActiveEnvironment({
      storeId: store.id,
      environment,
      userId: user?.id,
    });
  } catch {
    redirectWithParam('error', `activation_blocked_${environment}`);
  }

  revalidatePath(MERCADO_PAGO_ADMIN_DETAIL_PATH);
  redirectWithParam('activated', environment);
}
