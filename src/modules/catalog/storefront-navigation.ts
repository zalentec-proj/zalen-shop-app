import 'server-only';

import {
  createOptionalAdminClient,
  createOptionalPublicServerClient,
} from '@/lib/supabase/server';
import { logDevOnce } from '@/lib/logging/dev';
import type { StorefrontCategory } from '@/types';
import {
  getCategoryGroupKey,
  isCategoryGroupRoot,
  normalizeCategoryText,
} from './category-groups';
import {
  droneModelDefinitions,
  droneModelLineDefinitions,
} from './drone-model.definitions';
import { mergeBlingCategoriesIntoNavigation } from './storefront-navigation.catalog';

export type StorefrontNavigationItemType = 'category' | 'group' | 'custom';
export type StorefrontNavigationSource = 'database' | 'fallback';

export interface StorefrontNavigationItem {
  id: string;
  label: string;
  type: StorefrontNavigationItemType;
  categorySlug?: string;
  href?: string;
  parentId?: string;
  position: number;
  enabled: boolean;
  showInNavbar: boolean;
  showInCategoriesDropdown: boolean;
  opensInDropdown: boolean;
  children: StorefrontNavigationItem[];
}

export interface StorefrontNavigation {
  source: StorefrontNavigationSource;
  navbarItems: StorefrontNavigationItem[];
  categoryDropdownItems: StorefrontNavigationItem[];
  adminItems: StorefrontNavigationItem[];
}

export interface StorefrontNavigationItemInput {
  id?: string;
  label: string;
  type: StorefrontNavigationItemType;
  categorySlug?: string;
  href?: string;
  parentId?: string;
  position: number;
  enabled: boolean;
  showInNavbar: boolean;
  showInCategoriesDropdown: boolean;
  opensInDropdown: boolean;
}

type NavigationRow = {
  id: string;
  store_id: string;
  label: string;
  type: string;
  category_slug: string | null;
  href: string | null;
  parent_id: string | null;
  position: number | null;
  enabled: boolean | null;
  show_in_navbar: boolean | null;
  show_in_categories_dropdown: boolean | null;
  opens_in_dropdown: boolean | null;
};

const categoryDropdownRootLabels = new Set(['categorias', 'departamentos']);

const fallbackModelNavigationItems: StorefrontNavigationItemInput[] = [
  ...droneModelLineDefinitions.map((line) => ({
    id: `fallback-model-line-${line.slug}`,
    label: line.name,
    type: 'custom' as const,
    href: line.slug === 'flip' ? '/modelos/flip' : `/modelos/linha/${line.slug}`,
    position: 30 + line.position,
    enabled: true,
    showInNavbar: true,
    showInCategoriesDropdown: false,
    opensInDropdown: line.slug !== 'flip',
  })),
  ...droneModelDefinitions.map((model) => ({
    id: `fallback-model-${model.slug}`,
    label: model.name,
    type: 'custom' as const,
    href: `/modelos/${model.slug}`,
    parentId: `fallback-model-line-${model.lineSlug}`,
    position: model.position,
    enabled: true,
    showInNavbar: false,
    showInCategoriesDropdown: false,
    opensInDropdown: false,
  })),
];

const fallbackDefinitions: StorefrontNavigationItemInput[] = [
  {
    id: 'fallback-categorias',
    label: 'Categorias',
    type: 'group',
    position: 0,
    enabled: true,
    showInNavbar: true,
    showInCategoriesDropdown: true,
    opensInDropdown: true,
  },
  ...[
    ['Drones', 'drones'],
    ['Baterias', 'baterias'],
    ['Master Airscrew', 'master-airscrew'],
  ].map(([label, categorySlug], index) => ({
    id: `fallback-navbar-${categorySlug}`,
    label,
    type: 'category' as const,
    categorySlug,
    position: (index + 1) * 10,
    enabled: true,
    showInNavbar: true,
    showInCategoriesDropdown: true,
    opensInDropdown: false,
  })),
  ...fallbackModelNavigationItems,
  ...[
    ['Peças', 'pecas'],
    ['Acessórios', 'acessorios'],
    ['Hélices e Rotores', 'helices-e-rotores'],
    ['Sensores, IMU e GPS', 'sensores-imu-e-gps'],
    ['Câmeras e CMOS', 'cameras-e-cmos'],
    ['Carregadores e Hubs', 'carregadores-e-hubs'],
  ].map(([label, categorySlug], index) => ({
    id: `fallback-dropdown-${categorySlug}`,
    label,
    type: 'category' as const,
    categorySlug,
    parentId: 'fallback-categorias',
    position: (index + 1) * 10,
    enabled: true,
    showInNavbar: false,
    showInCategoriesDropdown: true,
    opensInDropdown: false,
  })),
];

function normalizeNavLabel(value: string) {
  return normalizeCategoryText(value).replace(/\s+/g, '-');
}

function getCategoryHref(categorySlug?: string) {
  return categorySlug ? `/categoria/${categorySlug}` : undefined;
}

function getInternalHref(value: string | null | undefined) {
  if (!value || !/^\/[a-z0-9][a-z0-9/_-]*$/.test(value)) {
    return undefined;
  }

  return value;
}

function isValidNavigationType(value: string): value is StorefrontNavigationItemType {
  return value === 'category' || value === 'group' || value === 'custom';
}

function categoryCanResolve(
  categorySlug: string | undefined,
  categoriesBySlug: Map<string, StorefrontCategory>
) {
  if (!categorySlug) return false;

  return (
    categoriesBySlug.has(categorySlug) ||
    isCategoryGroupRoot({ name: categorySlug, slug: categorySlug })
  );
}

function resolveCategorySlug(
  row: Pick<StorefrontNavigationItemInput, 'label' | 'categorySlug'>,
  categories: StorefrontCategory[]
) {
  if (row.categorySlug) {
    const exact = categories.find((category) => category.slug === row.categorySlug);

    if (exact) return exact.slug;

    if (isCategoryGroupRoot({ name: row.label, slug: row.categorySlug })) {
      return row.categorySlug;
    }
  }

  const normalizedLabel = normalizeNavLabel(row.label);
  const byExactText = categories.find((category) => {
    return (
      normalizeNavLabel(category.slug) === normalizedLabel ||
      normalizeNavLabel(category.name) === normalizedLabel
    );
  });

  if (byExactText) return byExactText.slug;

  const byGroup = categories.find((category) => {
    const groupKey = getCategoryGroupKey(category);
    return groupKey && normalizeNavLabel(groupKey) === normalizedLabel;
  });

  return byGroup?.slug;
}

function toNavigationRow(input: StorefrontNavigationItemInput): NavigationRow {
  return {
    id: input.id ?? `fallback-${normalizeNavLabel(input.label)}`,
    store_id: '',
    label: input.label,
    type: input.type,
    category_slug: input.categorySlug ?? null,
    href: input.href ?? null,
    parent_id: input.parentId ?? null,
    position: input.position,
    enabled: input.enabled,
    show_in_navbar: input.showInNavbar,
    show_in_categories_dropdown: input.showInCategoriesDropdown,
    opens_in_dropdown: input.opensInDropdown,
  };
}

function rowToItem(
  row: NavigationRow,
  categories: StorefrontCategory[]
): StorefrontNavigationItem | null {
  const type = isValidNavigationType(row.type) ? row.type : 'category';
  const categoriesBySlug = new Map(
    categories.map((category) => [category.slug, category])
  );
  const categorySlug =
    type === 'category' || row.category_slug
      ? resolveCategorySlug(
          {
            label: row.label,
            categorySlug: row.category_slug ?? undefined,
          },
          categories
        )
      : undefined;

  if (type === 'category' && !categoryCanResolve(categorySlug, categoriesBySlug)) {
    return null;
  }

  return {
    id: row.id,
    label: row.label,
    type,
    categorySlug,
    href: getInternalHref(row.href) ?? getCategoryHref(categorySlug),
    parentId: row.parent_id ?? undefined,
    position: row.position ?? 0,
    enabled: row.enabled ?? true,
    showInNavbar: row.show_in_navbar ?? false,
    showInCategoriesDropdown: row.show_in_categories_dropdown ?? false,
    opensInDropdown: row.opens_in_dropdown ?? false,
    children: [],
  };
}

function sortNavigationItems(items: StorefrontNavigationItem[]) {
  return [...items].sort((left, right) => {
    if (left.position !== right.position) return left.position - right.position;
    return left.label.localeCompare(right.label, 'pt-BR');
  });
}

function buildTree(items: StorefrontNavigationItem[]) {
  const byId = new Map<string, StorefrontNavigationItem>(
    items.map((item) => [item.id, { ...item, children: [] }])
  );
  const roots: StorefrontNavigationItem[] = [];

  for (const item of sortNavigationItems(Array.from(byId.values()))) {
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.children.push(item);
    } else {
      roots.push(item);
    }
  }

  for (const item of byId.values()) {
    item.children = sortNavigationItems(item.children);
  }

  return {
    byId,
    roots: sortNavigationItems(roots),
  };
}

function filterVisibleTree(
  items: StorefrontNavigationItem[]
): StorefrontNavigationItem[] {
  return sortNavigationItems(
    items
      .filter((item) => item.enabled)
      .map((item) => ({
        ...item,
        children: filterVisibleTree(item.children),
      }))
      .filter((item) => item.href || item.children.length > 0 || item.opensInDropdown)
  );
}

function buildNavigationFromRows(
  rows: NavigationRow[],
  categories: StorefrontCategory[],
  source: StorefrontNavigationSource
): StorefrontNavigation {
  const items = rows
    .map((row) => rowToItem(row, categories))
    .filter((item): item is StorefrontNavigationItem => Boolean(item));
  const publicItems = mergeBlingCategoriesIntoNavigation(items, categories);
  const editorialItems = publicItems.filter(
    (item) => !item.id.startsWith('bling-category-')
  );
  const tree = buildTree(publicItems);
  const visibleRoots = filterVisibleTree(tree.roots);
  const categoryDropdownItems = filterVisibleTree(
    publicItems.filter((item) => {
      if (!item.enabled || item.showInNavbar) return false;
      return item.showInCategoriesDropdown || Boolean(item.parentId);
    })
  );
  const navbarItems = visibleRoots
    .filter((item) => item.showInNavbar)
    .map((item) => {
      const normalizedLabel = normalizeNavLabel(item.label);
      const isCategoryDropdownRoot = categoryDropdownRootLabels.has(normalizedLabel);

      return isCategoryDropdownRoot
        ? { ...item, children: categoryDropdownItems }
        : item;
    });

  return {
    source,
    navbarItems,
    categoryDropdownItems,
    adminItems: sortNavigationItems(editorialItems),
  };
}

export function getFallbackStorefrontNavigation(
  categories: StorefrontCategory[]
): StorefrontNavigation {
  return buildNavigationFromRows(
    fallbackDefinitions.map(toNavigationRow),
    categories,
    'fallback'
  );
}

export async function getStorefrontNavigation(
  storeId: string,
  categories: StorefrontCategory[]
): Promise<StorefrontNavigation> {
  const clients = [createOptionalPublicServerClient(), createOptionalAdminClient()]
    .filter((client): client is NonNullable<typeof client> => Boolean(client));

  for (const supabase of clients) {
    const { data, error } = await supabase
      .from('storefront_navigation_items')
      .select(
        'id, store_id, label, type, category_slug, href, parent_id, position, enabled, show_in_navbar, show_in_categories_dropdown, opens_in_dropdown'
      )
      .eq('store_id', storeId)
      .order('position', { ascending: true });

    if (!error && data && data.length > 0) {
      return buildNavigationFromRows(data as NavigationRow[], categories, 'database');
    }

    if (error && error.code !== '42P01') {
      logDevOnce('storefront-navigation', 'using fallback navigation', {
        reason: error.message,
      });
    }
  }

  return getFallbackStorefrontNavigation(categories);
}

export async function getAdminStorefrontNavigation(
  storeId: string,
  categories: StorefrontCategory[]
): Promise<StorefrontNavigation> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return getFallbackStorefrontNavigation(categories);
  }

  const { data, error } = await supabase
    .from('storefront_navigation_items')
    .select(
      'id, store_id, label, type, category_slug, href, parent_id, position, enabled, show_in_navbar, show_in_categories_dropdown, opens_in_dropdown'
    )
    .eq('store_id', storeId)
    .order('position', { ascending: true });

  if (error || !data || data.length === 0) {
    return getFallbackStorefrontNavigation(categories);
  }

  return buildNavigationFromRows(data as NavigationRow[], categories, 'database');
}

export async function replaceStorefrontNavigationItems(
  storeId: string,
  items: StorefrontNavigationItemInput[]
) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return {
      ok: false,
      error: 'supabase-admin-not-configured',
    };
  }

  const now = new Date().toISOString();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const idMap = new Map(
    items.map((item) => [
      item.id,
      item.id && uuidPattern.test(item.id) ? item.id : crypto.randomUUID(),
    ])
  );
  const payload = items.map((item) => ({
    id: idMap.get(item.id) ?? crypto.randomUUID(),
    store_id: storeId,
    label: item.label,
    type: item.type,
    category_slug: item.categorySlug ?? null,
    href: item.href ?? null,
    parent_id: item.parentId ? idMap.get(item.parentId) ?? null : null,
    position: item.position,
    enabled: item.enabled,
    show_in_navbar: item.showInNavbar,
    show_in_categories_dropdown: item.showInCategoriesDropdown,
    opens_in_dropdown: item.opensInDropdown,
    updated_at: now,
  }));

  const { error: deleteError } = await supabase
    .from('storefront_navigation_items')
    .delete()
    .eq('store_id', storeId);

  if (deleteError) {
    return {
      ok: false,
      error: 'navigation-delete-failed',
    };
  }

  if (payload.length === 0) {
    return { ok: true };
  }

  const { error } = await supabase
    .from('storefront_navigation_items')
    .insert(payload);

  if (error) {
    return {
      ok: false,
      error: 'navigation-save-failed',
    };
  }

  return { ok: true };
}

export async function setStorefrontModelNavigationEnabled(
  storeId: string,
  enabled: boolean
) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return {
      ok: false,
      error: 'supabase-admin-not-configured',
    };
  }

  const { error } = await supabase
    .from('storefront_navigation_items')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .like('href', '/modelos/%');

  if (error) {
    return {
      ok: false,
      error: 'model-navigation-update-failed',
    };
  }

  return { ok: true };
}
