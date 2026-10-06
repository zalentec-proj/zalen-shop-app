import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createServerClient: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));

import { proxy } from './proxy';

const request = (url: string) => new NextRequest(url, {
  headers: { host: new URL(url).host, 'x-forwarded-proto': new URL(url).protocol.slice(0, -1) },
});

describe('platform/store login routing', () => {
  beforeEach(() => {
    vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'zalenshop.com.br');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'fixture-public-key');
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '.zalenshop.com.br');
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('keeps the original store and copied drawer when an expired session returns to login', async () => {
    const response = await proxy(request('https://lb-london.zalenshop.com.br/admin/produtos?page=2&produto=fixture-id'));
    const destination = new URL(response.headers.get('location')!);
    expect(destination.origin + destination.pathname).toBe('https://app.zalenshop.com.br/login');
    expect(destination.searchParams.get('next')).toBe('https://lb-london.zalenshop.com.br/admin/produtos?page=2&produto=fixture-id');
  });

  it('sends an existing session directly from platform login to the final store', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'fixture-user' } } });
    const response = await proxy(request('https://app.zalenshop.com.br/login'));
    expect(response.headers.get('location')).toBe('https://brasil-drones.zalenshop.com.br/admin');
  });

  it('preserves another store after an existing session reaches platform login', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'fixture-user' } } });
    const next = 'https://lb-london.zalenshop.com.br/admin/produtos?page=2';
    const response = await proxy(request(`https://app.zalenshop.com.br/login?next=${encodeURIComponent(next)}`));
    expect(response.headers.get('location')).toBe(next);
  });

  it('does not forward a session to a user-controlled external next host', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'fixture-user' } } });
    const response = await proxy(request('https://app.zalenshop.com.br/login?next=https://evil.example/admin'));
    expect(response.headers.get('location')).toBe('https://brasil-drones.zalenshop.com.br/admin');
  });

  it('copies refreshed session cookies into the redirect response', async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: { getUser: async () => {
        options.cookies.setAll([{ name: 'fixture-session', value: 'fixture-value', options: { path: '/', domain: '.zalenshop.com.br' } }]);
        return { data: { user: { id: 'fixture-user' } } };
      } },
    }));
    const response = await proxy(request('https://app.zalenshop.com.br/login'));
    expect(response.cookies.get('fixture-session')?.value).toBe('fixture-value');
    expect(response.cookies.get('fixture-session')?.domain).toBe('.zalenshop.com.br');
  });

  it('keeps local admin/login navigation on the same local host', async () => {
    const response = await proxy(request('http://localhost:3000/admin/pedidos?page=2'));
    const login = new URL(response.headers.get('location')!);
    expect(login.origin).toBe('http://localhost:3000');
    expect(login.searchParams.get('next')).toBe('http://localhost:3000/admin/pedidos?page=2');
  });

  it('retains direct platform admin compatibility without an auth mutation', async () => {
    const response = await proxy(request('https://app.zalenshop.com.br/admin/pedidos?page=2'));
    expect(response.headers.get('location')).toBe('https://brasil-drones.zalenshop.com.br/admin/pedidos?page=2');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
