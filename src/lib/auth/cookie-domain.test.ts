import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthCookieDomain } from './cookie-domain';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAuthCookieDomain', () => {
  it('compartilha a sessão entre os hosts da plataforma', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '.zalenshop.com.br');

    expect(getAuthCookieDomain('brasil-drones.zalenshop.com.br')).toBe(
      '.zalenshop.com.br'
    );
  });

  it('usa cookie host-only no domínio próprio da loja', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '.zalenshop.com.br');

    expect(getAuthCookieDomain('www.brasildroneseparts.com.br')).toBeUndefined();
  });

  it('não aplica domínio de cookie em hosts locais', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '.zalenshop.com.br');

    expect(getAuthCookieDomain('localhost:3000')).toBeUndefined();
  });
});
