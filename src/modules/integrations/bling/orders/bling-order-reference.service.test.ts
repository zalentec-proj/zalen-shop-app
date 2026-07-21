import { describe, expect, it, vi } from 'vitest';
import type { BlingOrderDraft } from './bling-order.types';
import { resolveBlingOrderReferences } from './bling-order-reference.service';

const draft = {
  orderId: 'order-1',
  orderNumber: 'BD-TEST-1',
  customer: {
    name: 'Cliente Teste',
    email: 'cliente@example.com',
    phone: '11999998888',
    document: '111.444.777-35',
  },
  shippingAddress: {
    street: 'Rua Teste',
    number: '10',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001-000',
  },
  items: [
    {
      sku: 'PRO-TP',
      name: 'Produto Teste',
      quantity: 1,
      unitPrice: 10,
      total: 10,
    },
  ],
  totals: {
    subtotal: 10,
    shipping: 12.16,
    discount: 0,
    total: 22.16,
  },
  payload: {
    numeroLoja: 'BD-TEST-1',
    data: '2026-07-20',
    dataSaida: '2026-07-20',
    dataPrevista: '2026-07-20',
    contato: {
      nome: 'Cliente Teste',
      tipoPessoa: 'F',
      numeroDocumento: '11144477735',
    },
    itens: [
      {
        codigo: 'PRO-TP',
        unidade: 'UN',
        quantidade: 1,
        valor: 10,
        descricao: 'Produto Teste',
      },
    ],
    parcelas: [{ dataVencimento: '2026-07-20', valor: 22.16 }],
  },
} satisfies BlingOrderDraft;

describe('resolveBlingOrderReferences', () => {
  it('reutiliza contato e produto existentes por documento e SKU', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 123, numeroDocumento: '11144477735' }],
      })
      .mockResolvedValueOnce({ data: [{ id: 456, codigo: 'PRO-TP' }] });

    const payload = await resolveBlingOrderReferences({ request }, draft);

    expect(request).toHaveBeenNthCalledWith(1, '/contatos', {
      query: { numeroDocumento: '11144477735', criterio: 1, limite: 100 },
    });
    expect(request).toHaveBeenNthCalledWith(2, '/produtos', {
      query: { 'codigos[]': ['PRO-TP'], criterio: 5, limite: 100 },
    });
    expect(payload.contato.id).toBe(123);
    expect(payload.itens[0]?.produto?.id).toBe(456);
  });

  it('cria o contato quando o documento ainda não existe no Bling', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { id: 789 } })
      .mockResolvedValueOnce({ data: [{ id: 456, codigo: 'PRO-TP' }] });

    const payload = await resolveBlingOrderReferences({ request }, draft);

    expect(request).toHaveBeenNthCalledWith(
      2,
      '/contatos',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          nome: 'Cliente Teste',
          situacao: 'A',
          tipo: 'F',
          numeroDocumento: '11144477735',
          endereco: {
            geral: expect.objectContaining({
              endereco: 'Rua Teste',
              cep: '01001000',
            }),
          },
        }),
      })
    );
    expect(payload.contato.id).toBe(789);
  });

  it('interrompe o envio quando o SKU não existe no Bling', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 123, numeroDocumento: '11144477735' }],
      })
      .mockResolvedValueOnce({ data: [] });

    await expect(resolveBlingOrderReferences({ request }, draft)).rejects.toThrow(
      'bling_product_not_found_for_sku'
    );
  });
});
