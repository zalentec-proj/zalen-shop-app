import { describe, expect, it } from 'vitest';
import {
  createBlingOAuthState,
  getStoreSlugFromBlingOAuthState,
} from './bling.oauth-state';

describe('Bling OAuth state', () => {
  it('carries the normalized store slug in an opaque state', () => {
    const state = createBlingOAuthState('Brasil-Drones');

    expect(state).toMatch(/^brasil-drones\.[A-Za-z0-9_-]{32,}$/);
    expect(getStoreSlugFromBlingOAuthState(state)).toBe('brasil-drones');
  });

  it('rejects malformed or legacy states without a store slug', () => {
    expect(getStoreSlugFromBlingOAuthState('opaque-state-only')).toBeNull();
    expect(getStoreSlugFromBlingOAuthState('../invalid.nonce')).toBeNull();
    expect(getStoreSlugFromBlingOAuthState('brasil-drones.short')).toBeNull();
  });
});
