import { headers } from 'next/headers';
import {
  checkStoreRole,
  storeManagementRoles,
} from '@/modules/auth/auth.service';
import { isDomainSelfServiceAvailable } from '@/modules/domains/domain-config';
import { listStoreDomains } from '@/modules/domains/domain.repository';
import { getServerEnv } from '@/lib/env/server';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { DomainsManager } from './DomainsManager';

export const dynamic = 'force-dynamic';

export default async function DomainsSettingsPage() {
  const headerStore = await headers();
  const store = await resolveCurrentStoreFromHeaders();
  const [access, domains] = await Promise.all([
    checkStoreRole(store.id, storeManagementRoles),
    listStoreDomains(store.id).catch(() => []),
  ]);
  const rootDomain = getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';
  const currentHost =
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    'localhost';

  return (
    <DomainsManager
      storeName={store.shortName}
      currentHost={currentHost}
      platformHostname={`${store.slug}.${rootDomain}`}
      domains={domains}
      canManage={access.allowed}
      featureAvailable={isDomainSelfServiceAvailable(store)}
    />
  );
}
