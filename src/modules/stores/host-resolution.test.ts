import { describe, expect, it } from 'vitest';
import {
  getRequestHost,
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

  it('prioriza o domínio público solicitado sobre o host interno do proxy', () => {
    const values = new Map([
      ['host', 'brasil-drones.zalenshop.com.br'],
      ['x-forwarded-host', 'zalen-shop-internal.vercel.app'],
    ]);

    expect(getRequestHost({ get: (name) => values.get(name) ?? null })).toBe(
      'brasil-drones.zalenshop.com.br'
    );
  });

  it('usa o primeiro host encaminhado quando o cabeçalho host não existe', () => {
    const values = new Map([
      [
        'x-forwarded-host',
        'brasil-drones.zalenshop.com.br, zalen-shop-internal.vercel.app',
      ],
    ]);

    expect(getRequestHost({ get: (name) => values.get(name) ?? null })).toBe(
      'brasil-drones.zalenshop.com.br'
    );
  });
});
