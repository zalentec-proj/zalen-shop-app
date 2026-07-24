export function countScheduledBlingCatalogChanges(input: {
  productsCreated: number;
  productsUpdated: number;
  variantsUpdated: number;
}) {
  return input.productsCreated + input.productsUpdated + input.variantsUpdated;
}

export function countWebhookBlingCatalogChanges(input: {
  productSyncs: number;
  inventorySyncs: number;
  productsInactivated: number;
}) {
  return input.productSyncs + input.inventorySyncs + input.productsInactivated;
}
