import 'server-only';

import {
  getDroneModelFromRepository,
  getDroneModelLineFromRepository,
  listDroneModelCatalogFromRepository,
  listProductDroneModelLinksFromRepository,
  listProductsForDroneModelFromRepository,
  listProductsForDroneModelLineFromRepository,
  replaceProductDroneModelsInRepository,
} from './drone-model.repository';
import type { ReplaceProductDroneModelsInput } from './drone-model.types';

export function listDroneModelCatalog(storeId: string) {
  return listDroneModelCatalogFromRepository(storeId);
}

export function listAdminDroneModelCatalog(storeId: string) {
  return listDroneModelCatalogFromRepository(storeId, {
    adminOnly: true,
    includeInactive: true,
  });
}

export function getDroneModel(storeId: string, slug: string) {
  return getDroneModelFromRepository(storeId, slug);
}

export function getDroneModelLine(storeId: string, slug: string) {
  return getDroneModelLineFromRepository(storeId, slug);
}

export function listProductsForDroneModel(storeId: string, modelId: string) {
  return listProductsForDroneModelFromRepository(storeId, modelId);
}

export function listProductsForDroneModelLine(storeId: string, lineId: string) {
  return listProductsForDroneModelLineFromRepository(storeId, lineId);
}

export function listProductDroneModelLinks(storeId: string, productIds: string[]) {
  return listProductDroneModelLinksFromRepository(storeId, productIds);
}

export function replaceProductDroneModels(input: ReplaceProductDroneModelsInput) {
  return replaceProductDroneModelsInRepository(input);
}
