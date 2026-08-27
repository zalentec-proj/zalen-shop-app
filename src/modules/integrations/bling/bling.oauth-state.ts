import { randomBytes } from 'node:crypto';

const stateSeparator = '.';
const storeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createBlingOAuthState(storeSlug: string) {
  const normalizedSlug = storeSlug.trim().toLowerCase();

  if (!storeSlugPattern.test(normalizedSlug)) {
    throw new Error('Invalid store slug for Bling OAuth state.');
  }

  return `${normalizedSlug}${stateSeparator}${randomBytes(32).toString('base64url')}`;
}

export function getStoreSlugFromBlingOAuthState(state: string) {
  const separatorIndex = state.indexOf(stateSeparator);

  if (separatorIndex <= 0) {
    return null;
  }

  const storeSlug = state.slice(0, separatorIndex);
  const nonce = state.slice(separatorIndex + stateSeparator.length);

  if (!storeSlugPattern.test(storeSlug) || nonce.length < 32) {
    return null;
  }

  return storeSlug;
}
