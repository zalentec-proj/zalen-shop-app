import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), resolveDestination: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/modules/auth/login-destination.service', () => ({ resolveLoginDestination: mocks.resolveDestination }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));

import { loginAction, logoutAction } from './actions';

const form = (next?: string) => {
  const data = new FormData();
  data.set('email', 'operator@example.test');
  data.set('password', 'fixture-only-password');
  if (next) data.set('next', next);
  return data;
};

describe('admin login action', () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut } });
    mocks.signIn.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
    mocks.resolveDestination.mockResolvedValue('https://brasil-drones.zalenshop.com.br/admin');
    mocks.redirect.mockImplementation((destination: string) => { throw new Error(`redirect:${destination}`); });
  });

  it('redirects a fresh authenticated session directly to the authorized store', async () => {
    await expect(loginAction({ error: null }, form())).rejects.toThrow('redirect:https://brasil-drones.zalenshop.com.br/admin');
    expect(mocks.resolveDestination).toHaveBeenCalledWith('verified-user', undefined);
    expect(mocks.redirect).not.toHaveBeenCalledWith('/admin');
  });

  it('uses only credentials for Supabase and passes next to the server-side resolver', async () => {
    await expect(loginAction({ error: null }, form('/admin/pedidos?page=2'))).rejects.toThrow('redirect:');
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'operator@example.test', password: 'fixture-only-password' });
    expect(mocks.resolveDestination).toHaveBeenCalledWith('verified-user', '/admin/pedidos?page=2');
  });

  it('rejects malformed credentials without authenticating', async () => {
    const data = form();
    data.set('email', 'invalid');
    await expect(loginAction({ error: null }, data)).resolves.toEqual({ error: 'E-mail ou senha inválidos.' });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it.each([
    { data: { user: null }, error: { message: 'provider details must not be exposed' } },
    { data: { user: null }, error: null },
  ])('does not navigate when authentication fails or has no user', async (result) => {
    mocks.signIn.mockResolvedValue(result);
    await expect(loginAction({ error: null }, form())).resolves.toEqual({ error: 'E-mail ou senha inválidos.' });
    expect(mocks.resolveDestination).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('shows safe feedback for a missing store permission', async () => {
    mocks.resolveDestination.mockResolvedValue(null);
    await expect(loginAction({ error: null }, form())).resolves.toEqual({ error: 'Sua conta não tem permissão para acessar esta loja.' });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('distinguishes an unavailable destination from invalid credentials without exposing the error', async () => {
    mocks.resolveDestination.mockRejectedValue(new Error('private provider details'));
    await expect(loginAction({ error: null }, form())).resolves.toEqual({ error: 'Não foi possível abrir o painel agora. Tente novamente.' });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('retains logout and its existing session scope', async () => {
    await expect(logoutAction()).rejects.toThrow('redirect:/login');
    expect(mocks.signOut).toHaveBeenCalledWith();
    expect(mocks.redirect).toHaveBeenCalledWith('/login');
  });
});
