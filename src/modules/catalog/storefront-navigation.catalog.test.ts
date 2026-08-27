import { describe, expect, it } from 'vitest';
import type { StorefrontCategory } from '@/types';
import {
  getFallbackStorefrontNavigation,
  type StorefrontNavigationItem,
} from './storefront-navigation';
import {
  countBlingManagedChildren,
  mergeBlingCategoriesIntoNavigation,
} from './storefront-navigation.catalog';

const rootItem: StorefrontNavigationItem = {
  id: 'navigation-air',
  label: 'Linha Air',
  type: 'custom',
  href: '/modelos/linha/air',
  position: 60,
  enabled: true,
  showInNavbar: true,
  showInCategoriesDropdown: false,
  opensInDropdown: true,
  children: [],
};

function category(
  input: Partial<StorefrontCategory> & Pick<StorefrontCategory, 'id' | 'name' | 'slug'>
): StorefrontCategory {
  return {
    productCount: 0,
    ...input,
  };
}

describe('Bling-backed storefront navigation', () => {
  it('builds the complete Categories popover from dropdown roots and preserves descendants', () => {
    const categories = [
      category({
        id: 'drones',
        externalId: 'bling:10',
        name: 'Drones',
        slug: 'drones',
        productCount: 3,
      }),
      category({
        id: 'batteries',
        externalId: 'bling:20',
        name: 'Baterias',
        slug: 'baterias-e-tampas',
      }),
      category({
        id: 'new-batteries',
        externalId: 'bling:21',
        name: 'Novo',
        slug: 'novo',
        parentId: 'batteries',
      }),
      category({
        id: 'used-batteries',
        externalId: 'bling:22',
        name: 'Semi Novo',
        slug: 'semi-novo',
        parentId: 'batteries',
      }),
    ];

    const navigation = getFallbackStorefrontNavigation(categories);
    const categoriesRoot = navigation.navbarItems.find(
      (item) => item.label === 'Categorias'
    );
    const batteries = categoriesRoot?.children.find(
      (item) => item.label === 'Baterias'
    );

    expect(categoriesRoot?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Drones' }),
        expect.objectContaining({ label: 'Baterias' }),
      ])
    );
    expect(batteries).toEqual(
      expect.objectContaining({
        categorySlug: 'baterias-e-tampas',
        children: expect.arrayContaining([
          expect.objectContaining({ label: 'Novo', categorySlug: 'novo' }),
          expect.objectContaining({ label: 'Semi Novo', categorySlug: 'semi-novo' }),
        ]),
      })
    );
  });

  it('replaces local model copies with the hierarchy mirrored from Bling', () => {
    const legacyChild: StorefrontNavigationItem = {
      ...rootItem,
      id: 'legacy-air-3',
      label: 'Air 3 antigo',
      href: '/modelos/air-3',
      parentId: rootItem.id,
      position: 10,
      showInNavbar: false,
      opensInDropdown: false,
    };
    const categories = [
      category({
        id: 'category-air',
        externalId: 'bling:100',
        name: 'Linha Air',
        slug: 'linha-air',
      }),
      category({
        id: 'category-air-3',
        externalId: 'bling:101',
        name: 'Air 3',
        slug: 'air-3',
        parentId: 'category-air',
        position: 30,
      }),
      category({
        id: 'category-air-3s',
        externalId: 'bling:102',
        name: 'Air 3S',
        slug: 'air-3s',
        parentId: 'category-air',
        position: 40,
      }),
    ];

    const result = mergeBlingCategoriesIntoNavigation(
      [rootItem, legacyChild],
      categories
    );

    expect(result).not.toContainEqual(expect.objectContaining({ id: legacyChild.id }));
    expect(result).toContainEqual(
      expect.objectContaining({
        id: 'navigation-air',
        categorySlug: 'linha-air',
      })
    );
    expect(result).toContainEqual(
      expect.objectContaining({
        label: 'Air 3',
        href: '/modelos/air-3',
        parentId: rootItem.id,
        type: 'custom',
      })
    );
    expect(result).toContainEqual(
      expect.objectContaining({
        label: 'Air 3S',
        href: '/modelos/air-3s',
        parentId: rootItem.id,
      })
    );
    expect(countBlingManagedChildren(rootItem, categories)).toBe(2);
  });

  it('keeps local children when the matching category is not from Bling', () => {
    const localChild: StorefrontNavigationItem = {
      ...rootItem,
      id: 'local-child',
      label: 'Local',
      parentId: rootItem.id,
      showInNavbar: false,
      opensInDropdown: false,
    };
    const categories = [
      category({
        id: 'local-category',
        name: 'Linha Air',
        slug: 'linha-air',
      }),
      category({
        id: 'local-category-child',
        name: 'Air 3',
        slug: 'air-3',
        parentId: 'local-category',
      }),
    ];

    expect(
      mergeBlingCategoriesIntoNavigation([rootItem, localChild], categories)
    ).toEqual([rootItem, localChild]);
    expect(countBlingManagedChildren(rootItem, categories)).toBe(0);
  });

  it('uses category routes for ERP descendants that are not drone models', () => {
    const categories = [
      category({
        id: 'parts-root',
        externalId: 'bling:200',
        name: 'Peças Originais DJI',
        slug: 'pecas-originais-dji',
      }),
      category({
        id: 'arms',
        externalId: 'bling:201',
        name: 'Braços',
        slug: 'bracos',
        parentId: 'parts-root',
      }),
    ];
    const partsRoot = {
      ...rootItem,
      id: 'navigation-parts',
      label: 'Peças Originais DJI',
      href: '/categoria/pecas-originais-dji',
    };

    expect(mergeBlingCategoriesIntoNavigation([partsRoot], categories)).toContainEqual(
      expect.objectContaining({
        label: 'Braços',
        href: '/categoria/bracos',
        type: 'category',
      })
    );
  });

  it('uses compatibility routes and commercial ordering for every imported model', () => {
    const categories = [
      category({
        id: 'mini-root',
        externalId: 'bling:300',
        name: 'Linha Mini',
        slug: 'linha-mini',
      }),
      category({
        id: 'mini-4-pro',
        externalId: 'bling:301',
        name: 'Mini 4 Pro',
        slug: 'mini-4-pro',
        parentId: 'mini-root',
        position: 0,
      }),
      category({
        id: 'mini-se',
        externalId: 'bling:302',
        name: 'Mini SE',
        slug: 'mini-se',
        parentId: 'mini-root',
        position: 0,
      }),
    ];
    const miniRoot = {
      ...rootItem,
      id: 'navigation-mini',
      label: 'Linha Mini',
      href: '/modelos/linha/mini',
    };

    const result = mergeBlingCategoriesIntoNavigation([miniRoot], categories);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Mini SE', href: '/modelos/mini-se' }),
        expect.objectContaining({ label: 'Mini 4 Pro', href: '/modelos/mini-4-pro' }),
      ])
    );
    expect(result.find((item) => item.label === 'Mini SE')?.position).toBeLessThan(
      result.find((item) => item.label === 'Mini 4 Pro')?.position ?? 0
    );
  });
});
