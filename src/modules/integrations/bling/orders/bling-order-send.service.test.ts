import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminOrderFixture as order } from '../../../../../tests/fixtures/admin-order';
const mocks = vi.hoisted(() => ({
  getOrder: vi.fn(), update: vi.fn(), claim: vi.fn(), settings: vi.fn(), running: vi.fn(),
  createJob: vi.fn(), complete: vi.fn(), event: vi.fn(), client: vi.fn(), references: vi.fn(), request: vi.fn(),
}));
vi.mock('@/modules/orders/order.repository', () => ({ getOrderByReferenceFromRepository: mocks.getOrder, updateOrderExternalErpStateInRepository: mocks.update, claimOrderBlingSendInRepository: mocks.claim }));
vi.mock('../bling.repository', () => ({ getBlingOrderSendSettingsFromRepository: mocks.settings, hasRunningBlingOrderSendJobInRepository: mocks.running, createBlingOrderSendJobInRepository: mocks.createJob, completeBlingOrderSendJobInRepository: mocks.complete, recordBlingOrderSendEventInRepository: mocks.event }));
vi.mock('../bling.api-client', async importOriginal => ({ ...await importOriginal<typeof import('../bling.api-client')>(), createBlingApiClientForStore: mocks.client }));
vi.mock('./bling-order-reference.service', () => ({ resolveBlingOrderReferences: mocks.references }));
import { sendOrderToBling } from './bling-order-send.service';

describe('operational Bling order send', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getOrder.mockResolvedValue(order);
    mocks.update.mockResolvedValue(undefined);
    mocks.claim.mockResolvedValue(true);
    mocks.settings.mockResolvedValue({ enabled: false, status: 'connected', environment: 'production' });
    mocks.running.mockResolvedValue(false);
    mocks.createJob.mockResolvedValue('job-1');
    mocks.complete.mockResolvedValue(undefined);
    mocks.event.mockResolvedValue(undefined);
    mocks.client.mockResolvedValue({ client: { request: mocks.request, hasRefreshedToken: () => false }, environment: 'production' });
    mocks.references.mockImplementation(async (_client, draft) => draft.payload);
    mocks.request.mockResolvedValue({ data: { id: 123 } });
  });
  const send = (trigger: 'checkout' | 'admin_retry' | 'admin_manual' | 'admin_test' = 'admin_manual') => sendOrderToBling({ storeId: order.storeId, orderId: order.id, trigger });
  it('sends a real order manually without enabling automatic sends or adding test warnings', async () => {
    expect(await send()).toMatchObject({ status: 'success', externalId: '123', testMode: false });
    expect(mocks.getOrder).toHaveBeenCalledWith(order.storeId, order.id);
    expect(mocks.claim).toHaveBeenCalledWith(order);
    expect(mocks.request).toHaveBeenCalledWith('/pedidos/vendas', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ numeroLoja: order.orderNumber }) }));
    expect(mocks.request.mock.calls[0][1].body.observacoesInternas).not.toContain('HOMOLOGAÇÃO');
  });
  it.each(['checkout', 'admin_retry'] as const)('preserves the automatic gate for %s', async trigger => {
    expect(await send(trigger)).toMatchObject({ status: 'skipped', errorCode: 'bling_order_send_disabled' });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('requires a connected integration even for manual sends', async () => {
    mocks.settings.mockResolvedValue({ enabled: false, status: 'disconnected' });
    expect(await send()).toMatchObject({ errorCode: 'bling_not_connected' });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([{ paymentStatus: 'pending' }, { paymentStatus: 'refunded' }, { status: 'cancelled' }])('rejects inoperable orders %j', async change => {
    mocks.getOrder.mockResolvedValue({ ...order, ...change });
    expect(await send()).toMatchObject({ status: 'error' });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('never sends a linked order again', async () => {
    mocks.getOrder.mockResolvedValue({ ...order, externalErpProvider: 'bling', externalErpId: '123' });
    expect(await send()).toMatchObject({ status: 'skipped', errorCode: 'order_already_synced' });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('does not send an order missing from the current store', async () => {
    mocks.getOrder.mockResolvedValue(null);
    expect(await send()).toMatchObject({ errorCode: 'order_not_found' });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('losing the atomic claim cannot create an external order', async () => {
    mocks.claim.mockResolvedValue(false);
    expect(await send()).toMatchObject({ errorCode: 'order_send_already_running' });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('preserves controlled homologation separately', async () => {
    expect(await send('admin_test')).toMatchObject({ status: 'success', testMode: true });
    expect(mocks.request.mock.calls[0][1].body.observacoesInternas).toContain('NÃO FATURAR');
  });
  it('blocks retry when the previous POST may already have created a sale', async () => {
    mocks.request.mockRejectedValue(new Error('Network lost with sensitive content'));
    expect(await send()).toMatchObject({ status: 'error', errorCode: 'bling_order_send_uncertain' });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ lastError: 'bling_order_send_uncertain' }));
    mocks.getOrder.mockResolvedValue({ ...order, externalErpLastError: 'bling_order_send_uncertain' });
    mocks.request.mockClear();
    expect(await send()).toMatchObject({ status: 'skipped', errorCode: 'bling_order_send_uncertain' });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('rejects incomplete customer data before contacting the provider', async () => {
    mocks.getOrder.mockResolvedValue({ ...order, customer: { name: 'Teste' } });
    expect(await send()).toMatchObject({ errorCode: 'order_missing_customer_data' });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('blocks missing company fiscal data instead of assuming an exemption', async () => {
    mocks.getOrder.mockResolvedValue({ ...order, customerType: 'pj', customer: { ...order.customer, document: '12345678000195' } });
    expect(await send()).toMatchObject({ errorCode: 'order_missing_company_fiscal_data' });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('keeps success when the sale is linked but the job audit fails', async () => {
    mocks.complete.mockRejectedValue(new Error('Audit unavailable'));
    expect(await send()).toMatchObject({ status: 'success', externalId: '123' });
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });
});
