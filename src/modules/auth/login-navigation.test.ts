import { describe, expect, it } from 'vitest';
import { getLoginRedirectTarget, getLoginRequestOrigin, getSafeLoginNextTarget } from './login-navigation';

const platform = 'https://app.zalenshop.com.br';
const store = 'https://brasil-drones.zalenshop.com.br';

describe('login navigation', () => {
  it.each([undefined, '/admin', `${platform}/admin`])('goes directly to the store after platform login: %s', (next) => {
    expect(getLoginRedirectTarget(next, platform, 'brasil-drones')).toBe(`${store}/admin`);
  });

  it('preserves the admin route, filters and copied drawer', () => {
    expect(getLoginRedirectTarget('/admin/pedidos?q=Drone%20Mini&page=2&pedido=order-id#detalhes', platform, 'brasil-drones'))
      .toBe(`${store}/admin/pedidos?q=Drone%20Mini&page=2&pedido=order-id#detalhes`);
  });

  it('preserves another canonical store instead of selecting the default store', () => {
    const destination = 'https://lb-london.zalenshop.com.br/admin/produtos?page=2';
    expect(getLoginRedirectTarget(destination, platform, 'brasil-drones')).toBe(destination);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://brasil-drones.lvh.me:3000', 'https://branch-preview.vercel.app', store])
    ('keeps same-origin admin navigation on %s', (origin) => {
      expect(getLoginRedirectTarget('/admin/produtos?page=2', origin, 'brasil-drones')).toBe('/admin/produtos?page=2');
    });

  it('supports a configured platform root without hardcoding the store hostname', () => {
    expect(getLoginRedirectTarget('/admin', 'https://app.example.com', 'another-store', 'example.com'))
      .toBe('https://another-store.example.com/admin');
  });

  it('keeps safe non-admin paths on the login origin', () => {
    expect(getLoginRedirectTarget('/conta', platform, 'brasil-drones')).toBe('/conta');
  });

  it.each([
    'https://evil.example/admin', '//evil.example/admin', '/\\evil.example/admin',
    '/%5Cevil.example/admin', '/\n/evil.example/admin', 'javascript:alert(1)',
    'https://app.zalenshop.com.br.evil.example/admin',
    'https://user:pass@app.zalenshop.com.br/admin',
    'http://app.zalenshop.com.br/admin', 'https://app.zalenshop.com.br:444/admin',
    'https://assets.zalenshop.com.br/admin', 'https://unknown.nested.zalenshop.com.br/admin',
    'https://lb-london.zalenshop.com.br/administer', 'https://lb-london.zalenshop.com.br/conta',
    'http://localhost:9000/admin', 'https://lb-london.lvh.me:3000/admin',
  ])('rejects unsafe next destinations: %s', (next) => {
    expect(getSafeLoginNextTarget(next, platform)).toBe('/admin');
  });

  it('accepts an absolute local admin path only on the current origin', () => {
    expect(getSafeLoginNextTarget('http://localhost:3000/admin', 'http://localhost:3000'))
      .toBe('http://localhost:3000/admin');
  });

  it('takes the public host rather than an internal forwarded deployment host', () => {
    const headers = new Headers({ host: 'app.zalenshop.com.br', 'x-forwarded-host': 'internal.vercel.app', 'x-forwarded-proto': 'https' });
    expect(getLoginRequestOrigin(headers, 'http://localhost:3000')).toBe(platform);
  });

  it('uses a configured origin only when the request has no host', () => {
    expect(getLoginRequestOrigin(new Headers(), platform)).toBe(platform);
  });
});
