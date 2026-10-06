import { describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/auth/login-destination.service', () => ({
  getLoginNavigationContext: async () => ({ requestOrigin: 'https://app.zalenshop.com.br', rootDomain: 'zalenshop.com.br' }),
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
});
