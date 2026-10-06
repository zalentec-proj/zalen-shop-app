import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminOrderFixture as order } from '../../../../tests/fixtures/admin-order';
const mocks = vi.hoisted(() => ({ role: vi.fn(), list: vi.fn(), get: vi.fn(), shipment: vi.fn(), payment: vi.fn(), settings: vi.fn() }));
vi.mock('@/modules/stores/store-resolution', () => ({ resolveCurrentStoreFromHeaders: async () => ({ id: order.storeId }) }));
vi.mock('@/modules/auth/auth.service', () => ({ checkStoreRole: mocks.role }));
vi.mock('@/modules/orders/order.service', () => ({ listOrdersPage: mocks.list, getOrderById: mocks.get }));
vi.mock('@/modules/shipping/shipment.service', () => ({ getShipmentsByOrderId: mocks.shipment }));
vi.mock('@/modules/payments/payment-transaction.repository', () => ({ getLatestPaymentTransactionByOrderId: mocks.payment }));
vi.mock('@/modules/integrations/bling/bling.repository', () => ({ getBlingOrderSendSettingsFromRepository: mocks.settings }));
vi.mock('@/components/admin/AdminDrawer', () => ({ AdminDrawer: ({ children }: { children: ReactNode }) => createElement('section', {}, children) }));
vi.mock('./OrderDetails', () => ({ OrderDetails: ({ order, canWrite }: { order: { orderNumber: string }; canWrite: boolean }) => createElement('div', { 'data-write': String(canWrite) }, order.orderNumber) }));
import OrdersPage from './page';

describe('order detail URL and access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role.mockResolvedValue({ allowed: true, membership: { role: 'store_admin' } });
    mocks.list.mockResolvedValue({ items: [], total: 0, page: 2, pageCount: 1, pageSize: 25, source: 'supabase' });
    mocks.get.mockResolvedValue(order);
    mocks.shipment.mockResolvedValue([]); mocks.payment.mockResolvedValue(null); mocks.settings.mockResolvedValue({ status: 'connected', enabled: false });
  });
  it('loads the record independently of the current list page and filters', async () => {
    const page = await OrdersPage({ searchParams: Promise.resolve({ page: '2', status: 'pending', q: 'another customer', record: order.id }) });
    expect(renderToStaticMarkup(page)).toContain(order.orderNumber);
    expect(mocks.get).toHaveBeenCalledWith(order.storeId, order.id);
    expect(mocks.shipment).toHaveBeenCalledWith({ storeId: order.storeId, orderId: order.id });
  });
  it('does not query orders before confirming access to the store', async () => {
    mocks.role.mockResolvedValue({ allowed: false });
    await OrdersPage({ searchParams: Promise.resolve({ record: order.id }) });
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it('normalizes an invalid record and does not query it', async () => {
    await OrdersPage({ searchParams: Promise.resolve({ record: 'invalid' }) });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('renders a viewer detail in read-only mode', async () => {
    mocks.role.mockResolvedValue({ allowed: true, membership: { role: 'store_viewer' } });
    const page = await OrdersPage({ searchParams: Promise.resolve({ record: order.id }) });
    expect(renderToStaticMarkup(page)).toContain('data-write="false"');
  });
});
