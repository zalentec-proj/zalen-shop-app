import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), resolveLoginDestination: vi.fn() }));
vi.mock('@/modules/auth/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

vi.mock('@/modules/auth/login-destination.service', () => ({
  getLoginNavigationContext: async () => ({ requestOrigin: 'https://app.zalenshop.com.br', rootDomain: 'zalenshop.com.br' }),
  resolveLoginDestination: mocks.resolveLoginDestination,
}));
vi.mock('./LoginClient', () => ({ default: () => null }));

import LoginPage from './page';

describe('login page next field', () => {
  it('preserves the store-specific destination supplied by the proxy', async () => {
    const next = 'https://lb-london.zalenshop.com.br/admin/produtos?page=2';
    const page = await LoginPage({ searchParams: Promise.resolve({ next }) });
    expect(page.props.nextPath).toBe(next);
  });

  it('removes unsafe destinations before they reach the form', async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({ next: '/\\evil.example/admin' }) });
    expect(page.props.nextPath).toBe('/admin');
  });

  it('does not manufacture a store next when the login has no destination', async () => {
    const page = await LoginPage({});
    expect(page.props.nextPath).toBe('');
  });

  it('authorizes an existing session on the server instead of in the proxy', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'owner' });
    mocks.resolveLoginDestination.mockResolvedValueOnce('https://app.zalenshop.com.br/platform');
    await expect(LoginPage({})).rejects.toThrow('redirect:https://app.zalenshop.com.br/platform');
  });

  it('routes an existing session with an unauthorized next to its allowed stores', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'store-user' });
    mocks.resolveLoginDestination.mockResolvedValueOnce(null);
    await expect(LoginPage({})).rejects.toThrow('redirect:/lojas?acesso=restrito');
  });

  it('renders safe feedback when an existing session cannot resolve its access', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user' });
    mocks.resolveLoginDestination.mockRejectedValueOnce(new Error('private details'));
    const page = await LoginPage({});
    expect(page.props.accessError).toBe('Não foi possível abrir o painel agora. Tente novamente.');
  });
});
