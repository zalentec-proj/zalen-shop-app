import { describe, expect, it } from 'vitest';
import {
  detectDroneModels,
  droneModelDefinitions,
  droneModelLineDefinitions,
} from './drone-model.definitions';

describe('drone model definitions', () => {
  it('keeps the requested model taxonomy unique', () => {
    expect(droneModelLineDefinitions).toHaveLength(8);
    expect(droneModelDefinitions).toHaveLength(31);
    expect(new Set(droneModelDefinitions.map((model) => model.slug)).size).toBe(
      droneModelDefinitions.length
    );
  });

  it('uses the most specific model from a product reference', () => {
    expect(detectDroneModels('Braço traseiro DJI Air 3S')).toEqual([
      {
        modelSlug: 'air-3s',
        matchedAlias: 'dji air 3s',
        confidence: 'review',
      },
    ]);
    expect(detectDroneModels('Placa core DJI Mini 4 Pro')).toEqual([
      {
        modelSlug: 'mini-4-pro',
        matchedAlias: 'dji mini 4 pro',
        confidence: 'review',
      },
    ]);
    expect(detectDroneModels('Gimbal DJI Mavic 3 Pro')).toEqual([
      {
        modelSlug: 'mavic-3-pro',
        matchedAlias: 'dji mavic 3 pro',
        confidence: 'review',
      },
    ]);
  });

  it('normalizes the Avata 02 alias to Avata 2 for review', () => {
    expect(detectDroneModels('Cabo flex DJI Avata 02')).toEqual([
      {
        modelSlug: 'avata-2',
        matchedAlias: 'avata 02',
        confidence: 'review',
      },
    ]);
  });
});
