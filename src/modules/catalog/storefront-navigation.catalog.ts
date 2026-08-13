import type { StorefrontCategory } from '@/types';
import {
  droneModelDefinitions,
  droneModelLineDefinitions,
} from './drone-model.definitions';
import { normalizeCategoryText } from './category-groups';
import type { StorefrontNavigationItem } from './storefront-navigation';

function normalizeComparable(value: string) {
  return normalizeCategoryText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isBlingCategory(category: StorefrontCategory) {
  return category.externalId?.startsWith('bling:') ?? false;
}

function getCategoryRoute(category: StorefrontCategory) {
  const normalizedName = normalizeComparable(category.name);
  const model = droneModelDefinitions.find((candidate) => {
    return (
      candidate.slug === category.slug ||
      normalizeComparable(candidate.name) === normalizedName
    );
  });

  if (model) {
    return `/modelos/${model.slug}`;
  }

  const line = droneModelLineDefinitions.find((candidate) => {
    return (
      candidate.slug === category.slug ||
      normalizeComparable(candidate.name) === normalizedName
    );
  });

  if (line) {
    return line.slug === 'flip'
      ? '/modelos/flip'
      : `/modelos/linha/${line.slug}`;
  }

  return `/categoria/${category.slug}`;
}

function getCategoryPosition(category: StorefrontCategory, fallbackIndex: number) {
  const model = droneModelDefinitions.find((candidate) => {
    return (
      candidate.slug === category.slug ||
      normalizeComparable(candidate.name) === normalizeComparable(category.name)
    );
  });

  if (model) return model.position;
  if (category.position && category.position > 0) return category.position;
  return (fallbackIndex + 1) * 10;
}

export function findBlingCategoryForNavigationItem(
  item: Pick<StorefrontNavigationItem, 'categorySlug' | 'label'>,
  categories: StorefrontCategory[]
) {
  const blingCategories = categories.filter(isBlingCategory);

  if (item.categorySlug) {
    const bySlug = blingCategories.find(
      (category) => category.slug === item.categorySlug
    );

    if (bySlug) return bySlug;
  }

  const normalizedLabel = normalizeComparable(item.label);

  return blingCategories.find(
    (category) => normalizeComparable(category.name) === normalizedLabel
  );
}

function collectNavigationDescendantIds(
  items: StorefrontNavigationItem[],
  parentId: string
): Set<string> {
  const directChildren = items.filter((item) => item.parentId === parentId);

  return new Set(
    directChildren.flatMap((child) => [
      child.id,
      ...collectNavigationDescendantIds(items, child.id),
    ])
  );
}

function createCatalogNavigationItems(
  parentItemId: string,
  parentCategoryId: string,
  categoriesByParentId: Map<string, StorefrontCategory[]>
): StorefrontNavigationItem[] {
  const children = [...(categoriesByParentId.get(parentCategoryId) ?? [])].sort(
    (left, right) => {
      const positionDifference = (left.position ?? 0) - (right.position ?? 0);
      return positionDifference || left.name.localeCompare(right.name, 'pt-BR');
    }
  );

  return children.flatMap((category, index) => {
    const id = `bling-category-${category.id}`;
    const descendants = createCatalogNavigationItems(
      id,
      category.id,
      categoriesByParentId
    );
    const href = getCategoryRoute(category);
    const usesCompatibilityRoute = href.startsWith('/modelos/');
    const item: StorefrontNavigationItem = {
      id,
      label: category.name,
      type: usesCompatibilityRoute ? 'custom' : 'category',
      categorySlug: category.slug,
      href,
      parentId: parentItemId,
      position: getCategoryPosition(category, index),
      enabled: true,
      showInNavbar: false,
      showInCategoriesDropdown: false,
      opensInDropdown: descendants.length > 0,
      children: [],
    };

    return [item, ...descendants];
  });
}

/**
 * Keeps root visibility/order editorial, but sources labels and descendants from
 * the Bling category mirror. Existing local children are replaced only when the
 * matching Bling category has a real hierarchy.
 */
export function mergeBlingCategoriesIntoNavigation(
  items: StorefrontNavigationItem[],
  categories: StorefrontCategory[]
) {
  const categoriesByParentId = new Map<string, StorefrontCategory[]>();

  categories.filter(isBlingCategory).forEach((category) => {
    if (!category.parentId) return;
    const siblings = categoriesByParentId.get(category.parentId) ?? [];
    siblings.push(category);
    categoriesByParentId.set(category.parentId, siblings);
  });

  const catalogRootByItemId = new Map<string, StorefrontCategory>();
  const replacedLocalIds = new Set<string>();

  items.forEach((item) => {
    const category = findBlingCategoryForNavigationItem(item, categories);

    if (!category) return;
    catalogRootByItemId.set(item.id, category);

    if (
      item.opensInDropdown &&
      (categoriesByParentId.get(category.id)?.length ?? 0) > 0
    ) {
      collectNavigationDescendantIds(items, item.id).forEach((id) => {
        replacedLocalIds.add(id);
      });
    }
  });

  const mergedRoots = items
    .filter((item) => !replacedLocalIds.has(item.id))
    .map((item) => {
      const category = catalogRootByItemId.get(item.id);

      return category
        ? {
            ...item,
            label: category.name,
            categorySlug: category.slug,
          }
        : item;
    });
  const generatedChildren = mergedRoots.flatMap((item) => {
    const category = catalogRootByItemId.get(item.id);

    if (
      !category ||
      !item.opensInDropdown ||
      (categoriesByParentId.get(category.id)?.length ?? 0) === 0
    ) {
      return [];
    }

    return createCatalogNavigationItems(
      item.id,
      category.id,
      categoriesByParentId
    );
  });

  return [...mergedRoots, ...generatedChildren];
}

export function countBlingManagedChildren(
  item: Pick<StorefrontNavigationItem, 'categorySlug' | 'label'>,
  categories: StorefrontCategory[]
) {
  const category = findBlingCategoryForNavigationItem(item, categories);

  if (!category) return 0;
  return categories.filter(
    (candidate) => isBlingCategory(candidate) && candidate.parentId === category.id
  ).length;
}
