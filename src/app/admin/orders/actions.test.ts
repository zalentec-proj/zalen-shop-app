import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminOrderFixture as order } from '../../../../tests/fixtures/admin-order';
const mocks = vi.hoisted(() => ({ role: vi.fn(), store: vi.fn(), send: vi.fn(), order: vi.fn(), shipments: vi.fn(), save: vi.fn(), mark: vi.fn(), email: vi.fn(), whatsapp: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/modules/auth/auth.service', () => ({ checkStoreRole: mocks.role }));
vi.mock('@/modules/stores/store-resolution', () => ({ resolveCurrentStoreFromHeaders: mocks.store }));
vi.mock('@/modules/integrations/bling/orders/bling-order-send.service', () => ({ sendOrderToBling: mocks.send }));
vi.mock('@/modules/orders/order.service', () => ({ getOrderById: mocks.order, markOrderShipmentState: mocks.mark }));
vi.mock('@/modules/shipping/shipment.service', () => ({ getShipmentsByOrderId: mocks.shipments, upsertManualShipment: mocks.save }));
vi.mock('@/modules/email/store-transactional-email.service', () => ({ sendShipmentTrackingStoreEmail: mocks.email }));
vi.mock('@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service', () => ({ enqueueShipmentWhatsAppNotification: mocks.whatsapp }));
import { sendOrderToBlingAction, upsertOrderShipmentAction } from './actions';
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }

describe('admin order actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.store.mockResolvedValue({ id: order.storeId, shortName: 'Loja teste' });
    mocks.role.mockResolvedValue({ allowed: true });
    mocks.send.mockResolvedValue({ status: 'success', orderNumber: order.orderNumber });
    mocks.order.mockResolvedValue(order);
    mocks.shipments.mockResolvedValue([{ id: 'shipment-1', shippedAt: '2026-10-01T12:00:00Z' }]);
    mocks.save.mockResolvedValue({ status: 'in_transit' });
    mocks.email.mockResolvedValue(undefined); mocks.whatsapp.mockResolvedValue(undefined);
  });
  it.each(['store_owner', 'store_admin', 'store_operator'])('enforces server permission and store context for %s', async role => {
    mocks.role.mockImplementation(async (_store, roles) => ({ allowed: roles.includes(role) }));
    expect(await sendOrderToBlingAction(form({ orderId: order.id, confirmation: 'send', storeId: 'forged-store' }))).toMatchObject({ ok: true });
    expect(mocks.send).toHaveBeenCalledWith({ storeId: order.storeId, orderId: order.id, trigger: 'admin_manual' });
  });
  it('rejects viewer and anonymous before any write or order read', async () => {
    mocks.role.mockResolvedValue({ allowed: false });
    expect(await sendOrderToBlingAction(form({ orderId: order.id, confirmation: 'send' }))).toMatchObject({ ok: false });
    expect(await upsertOrderShipmentAction(form({ orderId: order.id, status: 'posted' }))).toMatchObject({ ok: false });
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.order).not.toHaveBeenCalled();
  });
  it('requires explicit confirmation and a valid order ID', async () => {
    expect(await sendOrderToBlingAction(form({ orderId: order.id }))).toMatchObject({ ok: false });
    expect(await sendOrderToBlingAction(form({ orderId: 'invalid', confirmation: 'send' }))).toMatchObject({ ok: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('provides safe feedback when Bling fails', async () => {
    mocks.send.mockResolvedValue({ status: 'error', errorCode: 'sensitive payload' });
    const result = await sendOrderToBlingAction(form({ orderId: order.id, confirmation: 'send' }));
    expect(result.ok).toBe(false); expect(result.message).not.toContain('sensitive payload');
    expect(mocks.revalidate).toHaveBeenCalledWith('/admin/pedidos');
  });
  it('does not dispatch shipments for a cancelled order', async () => {
    mocks.order.mockResolvedValue({ ...order, status: 'cancelled' });
    expect(await upsertOrderShipmentAction(form({ orderId: order.id, status: 'posted', carrier: '', trackingCode: '', trackingUrl: '' }))).toMatchObject({ ok: false });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('updates the current shipment and retains its original posting date', async () => {
    expect(await upsertOrderShipmentAction(form({ orderId: order.id, status: 'in_transit', carrier: 'Teste', trackingCode: 'TEST123', trackingUrl: 'https://example.com/tracking' }))).toMatchObject({ ok: true });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ storeId: order.storeId, shipmentId: 'shipment-1', shippedAt: '2026-10-01T12:00:00Z' }));
  });
});
