export const activeStore = {
  id: '00000000-0000-0000-0000-000000000001',
  mockId: 'brasil-drones-store-001',
  name: 'Brasil Drones & Parts',
  shortName: 'Brasil Drones',
  slug: 'brasil-drones',
  storefrontPath: '/',
} as const;

export const ACTIVE_STORE_ID = activeStore.id;
export const ACTIVE_MOCK_STORE_ID = activeStore.mockId;

export function getActiveStore() {
  return activeStore;
}

export function getActiveStoreId() {
  return activeStore.id;
}
