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
  getAdminStorefrontNavigation,
  replaceStorefrontNavigationItems,
  type StorefrontNavigationItemInput,
  type StorefrontNavigationItemType,
} from '@/modules/catalog/storefront-navigation';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { adminActionError, adminActionSuccess, type AdminActionResult } from '@/modules/admin/admin-action-result';

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

const moveNavigationItemSchema = z.object({
  itemId: z.string().trim().min(1),
  direction: z.enum(['up', 'down']),
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

export async function saveStorefrontNavigationAction(formData: FormData): Promise<AdminActionResult> {
  const { store, allowed } = await ensureWritableAccess();

  if (!allowed) {
    return adminActionError('Você não possui permissão para alterar o menu público.');
  }

  const itemCount = Number(formData.get('itemCount') ?? 0);

  if (!Number.isInteger(itemCount) || itemCount < 0 || itemCount > 300) {
    return adminActionError('A configuração do menu é inválida. Atualize a página e tente novamente.');
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
      return adminActionError('Revise o nome, a rota e a posição do item.');
    }

    if (
      parsed.data.type === 'category' &&
      (!parsed.data.categorySlug ||
        !allowedCategorySlugs.has(parsed.data.categorySlug))
    ) {
      return adminActionError('A categoria vinculada não está disponível no catálogo.');
    }

    if (
      parsed.data.type === 'custom' &&
      !parsed.data.categorySlug &&
      !parsed.data.href &&
      !parsed.data.opensInDropdown &&
      !parsed.data.parentId
    ) {
      return adminActionError('Informe uma rota, categoria, submenu ou item pai.');
    }

    parsedItems.push(parsed.data);
  }

  const result = await replaceStorefrontNavigationItems(store.id, parsedItems);

  if (!result.ok) {
    return adminActionError('Não foi possível salvar o menu público.');
  }

  revalidatePath('/');
  revalidatePath('/admin/configuracoes/loja-online');
  revalidatePath('/categoria/[slug]', 'page');
  revalidatePath('/modelos/[slug]', 'page');
  revalidatePath('/modelos/linha/[slug]', 'page');
  return adminActionSuccess('Item do menu salvo com sucesso.');
}

export async function moveStorefrontNavigationItemAction(formData: FormData): Promise<AdminActionResult> {
  const { store, allowed } = await ensureWritableAccess();
  if (!allowed) return adminActionError('Você não possui permissão para reordenar o menu.');
  const parsed = moveNavigationItemSchema.safeParse({ itemId: formData.get('itemId'), direction: formData.get('direction') });
  if (!parsed.success) return adminActionError('Não foi possível identificar o item do menu.');
  const [catalogCategories, catalogProducts] = await Promise.all([listCategories(store.id), listStorefrontProducts(store.id)]);
  const storefrontCategories = toStorefrontCategories(catalogCategories, catalogProducts);
  const navigation = await getAdminStorefrontNavigation(store.id, storefrontCategories);
  const items = [...navigation.adminItems].sort((a,b)=>a.position-b.position);
  const index = items.findIndex((item)=>item.id===parsed.data.itemId);
  const targetIndex = parsed.data.direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return adminActionError('O item já está no limite desta posição.');
  const currentPosition = items[index].position;
  items[index] = { ...items[index], position: items[targetIndex].position };
  items[targetIndex] = { ...items[targetIndex], position: currentPosition };
  const result = await replaceStorefrontNavigationItems(store.id, items.map((item)=>({ id:item.id, label:item.label, type:item.type, categorySlug:item.categorySlug, href:item.href, parentId:item.parentId, position:item.position, enabled:item.enabled, showInNavbar:item.showInNavbar, showInCategoriesDropdown:item.showInCategoriesDropdown, opensInDropdown:item.opensInDropdown })));
  if (!result.ok) return adminActionError('Não foi possível reordenar o menu.');
  revalidatePath('/');
  revalidatePath('/admin/configuracoes/loja-online');
  return adminActionSuccess('Ordem do menu atualizada.');
}
