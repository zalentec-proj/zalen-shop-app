import 'server-only';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import { checkStoreRole, storeOperationalRoles } from '@/modules/auth/auth.service';
import { catalogSlug, manualProductSchema, type ManualProductFields } from './manual-product';

const messages: Record<string, string> = {
  forbidden: 'Você não possui permissão para cadastrar produtos nesta loja.',
  unavailable: 'Esta loja não está disponível para edição.',
  sku_taken: 'Este SKU já existe nesta loja. Use outro código.',
  conflict: 'O cadastro mudou ou já foi enviado. Abra o produto novamente antes de editar.',
  external_product: 'Este produto é gerenciado por uma integração. Use os ajustes operacionais do catálogo.',
  invalid_input: 'Revise os dados do produto.',
};

export async function saveManualProduct(storeId: string, input: unknown) {
  const access = await checkStoreRole(storeId, storeOperationalRoles);
  if (!access.allowed || !access.user) return { ok: false, message: messages.forbidden };
  const parsed = manualProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? messages.invalid_input };
  const admin = createOptionalAdminClient();
  if (!admin) return { ok: false, message: 'O catálogo está indisponível. Tente novamente.' };
  const { data, error } = await admin.rpc('save_manual_product', {
    p_actor_id: access.user.id,
    p_store_id: storeId,
    p_payload: { ...parsed.data, slug: catalogSlug(parsed.data.name) || `produto-${parsed.data.productId}`, categorySlug: catalogSlug(parsed.data.category) },
  });
  if (error || !data?.ok) return { ok: false, message: messages[data?.code] ?? 'Não foi possível salvar o produto. Tente novamente.' };
  return { ok: true, message: 'Produto salvo.', productId: parsed.data.productId };
}

export async function getManualProduct(storeId: string, productId: string): Promise<ManualProductFields | null> {
  const access = await checkStoreRole(storeId, storeOperationalRoles);
  if (!access.allowed || !zProductId(productId)) return null;
  const admin = createOptionalAdminClient();
  if (!admin) throw new Error('Catalog unavailable.');
  const { data, error } = await admin.from('products').select('id, name, description, status, external_provider, requires_shipping').eq('store_id', storeId).eq('id', productId).maybeSingle();
  if (error) throw new Error('Catalog unavailable.');
  if (!data || (data.external_provider && data.external_provider !== 'manual')) return null;
  const [variants, images, categories] = await Promise.all([
    admin.from('product_variants').select('sku, price, stock, weight, width, height, depth, attributes_json').eq('store_id', storeId).eq('product_id', productId),
    admin.from('product_images').select('url').eq('store_id', storeId).eq('product_id', productId).order('position').limit(1),
    admin.from('product_categories').select('categories!inner(name, store_id)').eq('product_id', productId).eq('categories.store_id', storeId).limit(1),
  ]);
  if (variants.error || images.error || categories.error) throw new Error('Catalog unavailable.');
  if (variants.data?.length !== 1) return null;
  const v = variants.data[0];
  const attrs = v.attributes_json ?? {};
  const category = (categories.data?.[0]?.categories as unknown as { name: string } | undefined)?.name ?? '';
  return {
    productId, mode: 'edit', name: data.name, description: data.description ?? '', sku: v.sku ?? '',
    author: typeof attrs.author === 'string' ? attrs.author : '', isbn: typeof attrs.isbn === 'string' ? attrs.isbn : '',
    format: data.requires_shipping ? 'physical' : 'ebook', price: String(v.price), stock: String(v.stock ?? 0), status: data.status,
    category, imageUrl: images.data?.[0]?.url ?? '',
    weight: v.weight == null ? '' : String(v.weight), width: v.width == null ? '' : String(v.width), height: v.height == null ? '' : String(v.height), depth: v.depth == null ? '' : String(v.depth),
  };
}

function zProductId(value: string) { return manualProductSchema.shape.productId.safeParse(value).success; }
