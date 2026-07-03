import type { StorefrontCategory } from '../../types';
import {
  type CategoryGroupKey,
  getCategoryGroupKey,
  normalizeCategoryText,
} from '../../modules/catalog/category-groups';

type PrimaryCategoryDefinition = {
  label: string;
  slug: 'drones' | 'pecas' | 'acessorios';
  groupKeys: CategoryGroupKey[];
};

export const primaryCategoryDefinitions: PrimaryCategoryDefinition[] = [
  { label: 'Drones', slug: 'drones', groupKeys: ['drones'] },
  { label: 'Peças', slug: 'pecas', groupKeys: ['pecas'] },
  {
    label: 'Acessórios',
    slug: 'acessorios',
    groupKeys: ['acessorios', 'baterias', 'kits-e-combos'],
  },
];

const primarySlugs = new Set(primaryCategoryDefinitions.map((item) => item.slug));

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getPrimaryCategoryDefinition(slug: string | null) {
  if (!slug) return undefined;
  const normalizedSlug = normalizeCategoryText(slug);

  return primaryCategoryDefinitions.find((item) => item.slug === normalizedSlug);
}

function categoryMatchesDefinition(
  category: StorefrontCategory,
  definition: PrimaryCategoryDefinition
) {
  const groupKey = getCategoryGroupKey(category);
  const normalizedSlug = normalizeCategoryText(category.slug);

  return (
    normalizedSlug === definition.slug ||
    Boolean(groupKey && definition.groupKeys.includes(groupKey))
  );
}

export function getPrimaryStorefrontCategories(
  categories: StorefrontCategory[]
): StorefrontCategory[] {
  return primaryCategoryDefinitions.map((definition) => {
    const root = categories.find(
      (category) => normalizeCategoryText(category.slug) === definition.slug
    );
    const groupedCategories = categories.filter((category) =>
      categoryMatchesDefinition(category, definition)
    );
    const productCount = root?.productCount ?? groupedCategories.reduce(
      (total, category) => total + category.productCount,
      0
    );

    return {
      id: root?.id ?? definition.slug,
      name: definition.label,
      slug: root?.slug ?? definition.slug,
      productCount,
      descendantSlugs: unique([
        ...(root?.descendantSlugs ?? []),
        ...groupedCategories.map((category) => category.slug),
        ...groupedCategories.flatMap((category) => category.descendantSlugs ?? []),
      ]),
    };
  });
}

export function getSecondaryCategoryTags(
  categories: StorefrontCategory[],
  limit = 12
) {
  return categories
    .filter((category) => {
      const normalizedSlug = normalizeCategoryText(category.slug);
      const groupKey = getCategoryGroupKey(category);

      return (
        !primarySlugs.has(normalizedSlug as PrimaryCategoryDefinition['slug']) &&
        Boolean(
          groupKey &&
            primaryCategoryDefinitions.some((definition) =>
              definition.groupKeys.includes(groupKey)
            )
        )
      );
    })
    .sort((left, right) => right.productCount - left.productCount)
    .slice(0, limit);
}

export function getAcceptedCategorySlugs(
  categories: StorefrontCategory[],
  selectedSlug: string
) {
  const activeCategory = categories.find(
    (category) => category.slug === selectedSlug
  );
  const primaryDefinition = getPrimaryCategoryDefinition(selectedSlug);

  return unique([
    selectedSlug,
    ...(activeCategory?.descendantSlugs ?? []),
    ...(primaryDefinition
      ? categories.flatMap((category) =>
          categoryMatchesDefinition(category, primaryDefinition)
            ? [category.slug, ...(category.descendantSlugs ?? [])]
            : []
        )
      : []),
  ]);
}
