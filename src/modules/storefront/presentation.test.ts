import { describe, expect, it } from 'vitest';
import { defaultPresentation, isRendererAllowed, presentationSchema } from './presentation';
import { newStoreSchema } from '@/modules/platform/store-management.schema';

const pilot = { id: '20000000-0000-4000-8000-000000000001', name: 'Loja Piloto', slug: 'loja-piloto' };
describe('store presentation boundary', () => {
  it('starts another store with no Brasil Drones identity or contacts', () => {
    const config = defaultPresentation(pilot);
    expect(config.renderer).toBe('neutral');
    expect(config.whatsapp).toBe('');
    expect(config.instagramUrl).toBe('');
    expect(config.logoUrl).toBe('');
    expect(JSON.stringify(config)).not.toMatch(/Brasil|Drones|DJI/);
    expect(presentationSchema.safeParse(config).success).toBe(true);
  });
  it('preserves the explicit Brasil Drones custom renderer', () => {
    const config = defaultPresentation({ id: '00000000-0000-0000-0000-000000000001', name: 'Brasil Drones & Parts', slug: 'brasil-drones' });
    expect(config.renderer).toBe('brasil-drones');
    expect(config.whatsapp).toBe('5545999431780');
    expect(isRendererAllowed(config.renderer, pilot)).toBe(false);
    expect(defaultPresentation({ ...pilot, slug: 'brasil-drones' }).renderer).toBe('neutral');
  });
  it.each(['javascript:alert(1)', 'data:image/svg+xml,test', 'https://cdn.example/logo.svg', 'https://user:password@cdn.example/logo.png', '//cdn.example/a.png'])('rejects unsafe visual URL %s', (logoUrl) => {
    expect(presentationSchema.safeParse({ ...defaultPresentation(pilot), logoUrl }).success).toBe(false);
  });
  it('allows only validated colors and structured fields', () => {
    expect(presentationSchema.safeParse({ ...defaultPresentation(pilot), primaryColor: 'red;display:none' }).success).toBe(false);
    expect(presentationSchema.safeParse({ ...defaultPresentation(pilot), script: 'alert(1)' }).success).toBe(false);
    expect(presentationSchema.safeParse({ ...defaultPresentation(pilot), logoUrl: 'https://cdn.example/a.webp' }).success).toBe(true);
  });
  it('rejects reserved and malformed store addresses on the server', () => {
    const input = { requestId: '20000000-0000-4000-8000-000000000002', name: pilot.name, slug: pilot.slug, ownerEmail: 'owner@example.test' };
    expect(newStoreSchema.safeParse(input).success).toBe(true);
    expect(newStoreSchema.parse({ ...input, ownerEmail: ' OWNER@EXAMPLE.TEST ' }).ownerEmail).toBe('owner@example.test');
    for (const slug of ['app', 'admin', 'www', 'api', 'assets', 'static', 'support', 'Upper', 'with.dot', 'space slug', '-bad']) expect(newStoreSchema.safeParse({ ...input, slug }).success).toBe(false);
  });
});
