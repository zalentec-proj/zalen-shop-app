import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: vi.fn(), products: vi.fn(), customers: vi.fn(), catalog: vi.fn(), links: vi.fn() }));
vi.mock('@/modules/auth/auth.service', () => ({ checkStoreRole: mocks.role }));
vi.mock('@/modules/stores/store-resolution', () => ({ resolveCurrentStoreFromHeaders: async () => ({ id: 'store-a' }) }));
vi.mock('@/modules/catalog/product.service', () => ({ listAdminProductsPage: mocks.products }));
vi.mock('@/modules/customers/customer.service', () => ({ listCustomersPage: mocks.customers }));
vi.mock('@/modules/catalog/drone-model.service', () => ({ listAdminDroneModelCatalog: mocks.catalog, listProductDroneModelLinks: mocks.links }));
vi.mock('@/components/admin/AdminDrawer', () => ({ AdminDrawer: ({ children }: { children: ReactNode }) => createElement('section', {}, children) }));
vi.mock('@/components/admin/AdminActionForm', () => ({ AdminActionForm: ({ children }: { children: ReactNode }) => createElement('form', {}, children) }));
vi.mock('./configuracoes/compatibilidade/CompatibilityManager', () => ({ default: ({ readOnly }: { readOnly: boolean }) => createElement('div', { 'data-readonly': String(readOnly) }) }));
import ProductsPage from './produtos/page';
import CustomersPage from './clientes/page';
import CompatibilityPage from './configuracoes/compatibilidade/page';

const pageResult = { items: [], total: 0, page: 1, pageCount: 1, pageSize: 25, source: 'supabase' };
describe('admin local read authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role.mockResolvedValue({ allowed: true, membership: { role: 'store_admin' } });
    mocks.products.mockResolvedValue({ ...pageResult, items: [{ id: 'product-a', name: 'Produto', price: 100, stock: 3, status: 'active', categories: [] }] });
    mocks.customers.mockResolvedValue(pageResult);
    mocks.catalog.mockResolvedValue([]); mocks.links.mockResolvedValue([]);
  });
  it.each([ProductsPage, CustomersPage, CompatibilityPage])('does not read privileged data when access is denied', async Page => {
    mocks.role.mockResolvedValue({ allowed: false });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ record: 'product-a', new: 'customer' }) }));
    expect(html).toContain('Acesso restrito');
    for (const query of [mocks.products, mocks.customers, mocks.catalog, mocks.links]) expect(query).not.toHaveBeenCalled();
    expect(mocks.role).toHaveBeenCalledWith('store-a', ['store_owner', 'store_admin', 'store_operator', 'store_viewer']);
  });
  it.each(['store_owner', 'store_admin', 'store_operator'])('allows operational controls for %s', async role => {
    mocks.role.mockResolvedValue({ allowed: true, membership: { role } });
    expect(renderToStaticMarkup(await ProductsPage({ searchParams: Promise.resolve({ record: 'product-a' }) }))).toContain('Estoque disponível');
    expect(renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({ new: 'customer' }) }))).toContain('Cadastrar cliente');
    expect(renderToStaticMarkup(await CompatibilityPage({ searchParams: Promise.resolve({}) }))).toContain('data-readonly="false"');
  });
  it('does not expose mutating controls even when a viewer supplies overlay parameters', async () => {
    mocks.role.mockResolvedValue({ allowed: true, membership: { role: 'store_viewer' } });
    const products = renderToStaticMarkup(await ProductsPage({ searchParams: Promise.resolve({ record: 'product-a' }) }));
    expect(products).toContain('somente para consulta'); expect(products).not.toContain('Estoque disponível');
    const customers = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({ new: 'customer' }) }));
    expect(customers).not.toContain('Novo cliente'); expect(customers).not.toContain('Cadastrar cliente');
    const compatibility = renderToStaticMarkup(await CompatibilityPage({ searchParams: Promise.resolve({}) }));
    expect(compatibility).toContain('data-readonly="true"'); expect(compatibility).not.toContain('Ativar menu de modelos');
  });
  it('does not expose mutating controls for demonstration data', async () => {
    mocks.products.mockResolvedValue({ ...pageResult, source: 'mock', items: [{ id: 'product-a', name: 'Produto', price: 100, stock: 3, status: 'active', categories: [] }] });
    expect(renderToStaticMarkup(await ProductsPage({ searchParams: Promise.resolve({ record: 'product-a' }) }))).not.toContain('Estoque disponível');
  });
});
