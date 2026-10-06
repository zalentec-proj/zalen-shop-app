import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { adminOrderFixture as order } from '../../../../tests/fixtures/admin-order';
vi.mock('../orders/actions', () => ({ sendOrderToBlingAction: vi.fn(), upsertOrderShipmentAction: vi.fn() }));
vi.mock('@/components/admin/AdminActionForm', () => ({ AdminActionForm: ({ children }: { children: ReactNode }) => createElement('form', {}, children) }));
import { OrderDetails } from './OrderDetails';
import type { Shipment } from '@/modules/shipping/shipment.types';

describe('admin order detail rendering', () => {
  const render = (overrides: Partial<Parameters<typeof OrderDetails>[0]> = {}) => renderToStaticMarkup(createElement(OrderDetails, { order, payment: null, shipments: [], canWrite: true, blingConnected: true, automaticSendEnabled: false, ...overrides }));
  it('renders fiscal, delivery, item and financial snapshots', () => {
    const html = render();
    for (const text of ['11144477735', 'Rua teste', 'Sala 2', '01001000', 'SKU-TEST-1', 'Resumo financeiro', 'Meio de pagamento', 'já incluída nos preços']) expect(html).toContain(text);
    expect(html).toContain('Enviar pedido ao Bling');
    expect(html).toContain('name="confirmation"');
  });
  it('does not offer any mutation to a viewer', () => {
    const html = render({ canWrite: false });
    expect(html).not.toContain('Enviar pedido ao Bling');
    expect(html).not.toContain('Salvar envio');
    expect(html).not.toContain('<form');
  });
  it.each(['pending', 'refunded'] as const)('does not allow operations for payment %s', paymentStatus => {
    const html = render({ order: { ...order, paymentStatus } });
    expect(html).not.toContain('Enviar pedido ao Bling');
    expect(html).not.toContain('Salvar envio');
  });
  it('preserves existing shipment form values and does not reset status', () => {
    const html = render({ shipments: [{ carrier: 'Transportadora teste', trackingCode: 'TEST123', trackingUrl: 'https://example.com/rastreio', status: 'in_transit' } as Shipment] });
    expect(html).toContain('value="TEST123"');
    expect(html).toContain('value="Transportadora teste"');
    expect(html).toContain('value="https://example.com/rastreio"');
    expect(html).toContain('value="in_transit" selected=""');
  });
  it('offers reconnection, not a send button, for a disconnected provider', () => {
    const html = render({ blingConnected: false });
    expect(html).toContain('/admin/integracoes/bling');
    expect(html).not.toContain('Enviar pedido ao Bling');
  });
  it('blocks sending an uncertain sale and explains why', () => {
    const html = render({ order: { ...order, externalErpLastError: 'bling_order_send_uncertain' } });
    expect(html).toContain('evitar duplicidade');
    expect(html).not.toContain('Enviar pedido ao Bling');
  });
});
