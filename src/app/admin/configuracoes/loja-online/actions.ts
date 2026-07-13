'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import {
  listCategories,
  listStorefrontProducts,
} from '@/modules/catalog/product.service';
import {
  toStorefrontCategories,
} from '@/modules/catalog/storefront-product.adapter';
import {
  replaceStorefrontNavigationItems,
  type StorefrontNavigationItemInput,
  type StorefrontNavigationItemType,
} from '@/modules/catalog/storefront-navigation';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const writableStoreRoles: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_operator',
];

const rootGroupSlugs = new Set([
  'drones',
  'pecas',
  'baterias',
  'acessorios',
  'kits-e-combos',
]);

const navigationItemSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(2).max(80),
  type: z.enum(['category', 'group', 'custom']),
  categorySlug: z.string().trim().optional(),
  href: z
    .string()
    .trim()
    .regex(/^\/[a-z0-9][a-z0-9/_-]*$/, 'Use uma rota interna iniciada por /.')
    .optional()
    .or(z.literal('')),
  parentId: z.string().trim().optional(),
  position: z.coerce.number().int().min(0).max(10000),
  enabled: z.boolean(),
  showInNavbar: z.boolean(),
  showInCategoriesDropdown: z.boolean(),
  opensInDropdown: z.boolean(),
});

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

async function ensureWritableAccess() {
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableStoreRoles);

  return {
    store,
    allowed: access.allowed,
  };
}

export async function saveStorefrontNavigationAction(formData: FormData) {
  const { store, allowed } = await ensureWritableAccess();

  if (!allowed) {
    return;
  }

  const itemCount = Number(formData.get('itemCount') ?? 0);

  if (!Number.isInteger(itemCount) || itemCount < 0 || itemCount > 300) {
    return;
  }

  const [catalogCategories, catalogProducts] = await Promise.all([
    listCategories(store.id),
    listStorefrontProducts(store.id),
  ]);
  const storefrontCategories = toStorefrontCategories(
    catalogCategories,
    catalogProducts
  );
  const allowedCategorySlugs = new Set([
    ...storefrontCategories.map((category) => category.slug),
    ...rootGroupSlugs,
  ]);
  const parsedItems: StorefrontNavigationItemInput[] = [];

  for (let index = 0; index < itemCount; index += 1) {
    const prefix = `items.${index}`;
    const type = String(formData.get(`${prefix}.type`) ?? 'category') as
      StorefrontNavigationItemType;
    const categorySlug = String(
      formData.get(`${prefix}.categorySlug`) ?? ''
    ).trim();
    const parentId = String(formData.get(`${prefix}.parentId`) ?? '').trim();
    const href = String(formData.get(`${prefix}.href`) ?? '').trim();
    const raw = {
      id: String(formData.get(`${prefix}.id`) ?? '').trim() || undefined,
      label: String(formData.get(`${prefix}.label`) ?? '').trim(),
      type,
      categorySlug: categorySlug || undefined,
      href: href || undefined,
      parentId: parentId || undefined,
      position: formData.get(`${prefix}.position`),
      enabled: getBoolean(formData, `${prefix}.enabled`),
      showInNavbar: getBoolean(formData, `${prefix}.showInNavbar`),
      showInCategoriesDropdown: getBoolean(
        formData,
        `${prefix}.showInCategoriesDropdown`
      ),
      opensInDropdown: getBoolean(formData, `${prefix}.opensInDropdown`),
    };
    const parsed = navigationItemSchema.safeParse(raw);

    if (!parsed.success) {
      return;
    }

    if (
      parsed.data.type === 'category' &&
      (!parsed.data.categorySlug ||
        !allowedCategorySlugs.has(parsed.data.categorySlug))
    ) {
      return;
    }

    if (
      parsed.data.type === 'custom' &&
      !parsed.data.categorySlug &&
      !parsed.data.href &&
      !parsed.data.opensInDropdown &&
      !parsed.data.parentId
    ) {
      return;
    }

    parsedItems.push(parsed.data);
  }

  const result = await replaceStorefrontNavigationItems(store.id, parsedItems);

  if (!result.ok) {
    return;
  }

  revalidatePath('/');
  revalidatePath('/admin/configuracoes/loja-online');
  revalidatePath('/categoria/[slug]', 'page');
  revalidatePath('/modelos/[slug]', 'page');
  revalidatePath('/modelos/linha/[slug]', 'page');
}
