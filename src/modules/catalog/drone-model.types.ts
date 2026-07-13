export type DroneModelCompatibilitySource =
  | 'seed'
  | 'detected'
  | 'manual'
  | 'import';

export type DroneModelCompatibilityConfidence = 'confirmed' | 'review';

export interface DroneModelLine {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  position: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface DroneModel {
  id: string;
  storeId: string;
  lineId: string;
  name: string;
  slug: string;
  aliases: string[];
  position: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface DroneModelCatalogLine extends DroneModelLine {
  models: DroneModel[];
}

export interface ProductDroneModelLink {
  storeId: string;
  productId: string;
  droneModelId: string;
  source: DroneModelCompatibilitySource;
  confidence: DroneModelCompatibilityConfidence;
}

export interface DroneModelDetection {
  modelSlug: string;
  matchedAlias: string;
  confidence: DroneModelCompatibilityConfidence;
}

export interface ReplaceProductDroneModelsInput {
  storeId: string;
  productId: string;
  modelIds: string[];
  source: DroneModelCompatibilitySource;
  confidence: DroneModelCompatibilityConfidence;
}

export type ProductDroneModelMutationResult =
  | { ok: true }
  | { ok: false; error: string };
