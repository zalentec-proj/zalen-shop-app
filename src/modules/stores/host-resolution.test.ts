import { describe, expect, it } from 'vitest';
import {
  getStoreSlugFromHostname,
  normalizeHostname,
} from './host-resolution';

describe('host resolution helpers', () => {
  it('normaliza host com porta', () => {
    expect(normalizeHostname('Brasil-Drones.LVH.me:3000')).toBe(
      'brasil-drones.lvh.me'
    );
  });

  it('resolve subdomínio local e da plataforma', () => {
    expect(getStoreSlugFromHostname('brasil-drones.lvh.me')).toBe(
      'brasil-drones'
    );
    expect(getStoreSlugFromHostname('brasil-drones.zalenshop.com.br')).toBe(
      'brasil-drones'
    );
  });

  it('não interpreta domínio externo como slug', () => {
    expect(getStoreSlugFromHostname('www.brasildrones.com.br')).toBeUndefined();
  });
});
