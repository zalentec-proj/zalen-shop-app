import { describe, expect, it } from 'vitest';
import { getBlingProductExternalIdsFromReconciliationPage } from './bling-product-reconciliation.logic';

describe('páginas da reconciliação de produtos Bling', () => {
  it('aceita uma página completa e normaliza IDs externos para texto', () => {
    expect(
      Array.from(
        getBlingProductExternalIdsFromReconciliationPage({
          data: [{ id: 101 }, { id: 202 }],
        })
      )
    ).toEqual(['101', '202']);
  });

  it('recusa resposta sem a lista de dados para não confundi-la com catálogo vazio', () => {
    expect(() =>
      getBlingProductExternalIdsFromReconciliationPage({})
    ).toThrow('bling_product_reconciliation_invalid_response');
  });

  it('recusa produtos sem ID e IDs duplicados na mesma página', () => {
    expect(() =>
      getBlingProductExternalIdsFromReconciliationPage({ data: [{ nome: 'Sem ID' }] })
    ).toThrow('bling_product_reconciliation_missing_product_id');

    expect(() =>
      getBlingProductExternalIdsFromReconciliationPage({
        data: [{ id: 7 }, { id: 7 }],
      })
    ).toThrow('bling_product_reconciliation_duplicate_product_id');
  });
});
