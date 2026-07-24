import { describe, expect, it } from 'vitest';
import {
  countScheduledBlingCatalogChanges,
  countWebhookBlingCatalogChanges,
} from './bling-job-change-detection';

describe('detecção de alterações dos jobs do Bling', () => {
  it('mantém o cache quando a sincronização agendada não alterou o catálogo', () => {
    expect(
      countScheduledBlingCatalogChanges({
        productsCreated: 0,
        productsUpdated: 0,
        variantsUpdated: 0,
      })
    ).toBe(0);
  });

  it('soma produtos e estoques realmente processados pela sincronização', () => {
    expect(
      countScheduledBlingCatalogChanges({
        productsCreated: 1,
        productsUpdated: 2,
        variantsUpdated: 3,
      })
    ).toBe(6);
  });

  it('solicita atualização após webhooks que afetam catálogo ou estoque', () => {
    expect(
      countWebhookBlingCatalogChanges({
        productSyncs: 1,
        inventorySyncs: 1,
        productsInactivated: 1,
      })
    ).toBe(3);
  });
});
