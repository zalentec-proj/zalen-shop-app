import { describe, expect, it } from 'vitest';
import { getPlatformOrigin, getStoreAdminUrl, isPlatformPath } from './operational-navigation';

describe('operational origins', () => {
  it('keeps platform and store admin addresses separate', () => {
    expect(getPlatformOrigin('https://lb-london.zalenshop.com.br')).toBe('https://app.zalenshop.com.br');
    expect(getStoreAdminUrl('lb-london', 'https://app.zalenshop.com.br')).toBe('https://lb-london.zalenshop.com.br/admin');
  });

  it('supports local subdomains and preserves the development port', () => {
    expect(getStoreAdminUrl('lb-london', 'http://localhost:3001')).toBe('http://lb-london.lvh.me:3001/admin');
  });

  it.each(['app', 'www', 'api', 'another.host', 'other/shop', '../evil', 'https://evil.example'])('rejects a reserved or unsafe store slug: %s', (slug) => {
    expect(getStoreAdminUrl(slug, 'https://app.zalenshop.com.br')).toBeNull();
  });

  it.each(['https://evil.example', '//evil.example', '/admin/../../login', '/administer'])('does not build untrusted links: %s', (path) => {
    expect(getStoreAdminUrl('store', 'https://app.zalenshop.com.br', undefined, path)).toBeNull();
  });

  it('does not match similarly named public routes', () => {
    expect(isPlatformPath('/platforming')).toBe(false);
    expect(isPlatformPath('/platform/lojas')).toBe(true);
  });
});
