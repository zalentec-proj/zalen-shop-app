import { describe, expect, it } from 'vitest';
import * as category from './categoria/[slug]/page';
import * as product from './produto/[slug]/page';
import * as model from './modelos/[slug]/page';
import * as modelLine from './modelos/linha/[slug]/page';

describe('host-scoped storefront rendering', () => {
  it.each([['category', category], ['product', product], ['model', model], ['model line', modelLine]] as const)('renders %s per request, not from a global store build snapshot', (_name, route) => {
    expect(route.dynamic).toBe('force-dynamic');
    expect(route).not.toHaveProperty('generateStaticParams');
  });
});
