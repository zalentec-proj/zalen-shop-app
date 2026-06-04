import { activeStore } from '@/modules/stores/current-store';

export const currentStoreBrand = {
  name: activeStore.name,
  shortName: activeStore.shortName,
  slug: activeStore.slug,
  storeId: activeStore.id,
  storefrontPath: activeStore.storefrontPath,
} as const;
