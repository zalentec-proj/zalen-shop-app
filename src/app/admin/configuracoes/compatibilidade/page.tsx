import { SettingsBadge, SettingsPanel } from '../SettingsShell';
import CompatibilityManager from './CompatibilityManager';
import { activateDroneModelNavigationAction } from './actions';
import { detectDroneModels } from '@/modules/catalog/drone-model.definitions';
import {
  listAdminDroneModelCatalog,
  listProductDroneModelLinks,
} from '@/modules/catalog/drone-model.service';
import { listAdminProductsWithSource } from '@/modules/catalog/product.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

export default async function CompatibilityPage() {
  const store = await resolveCurrentStoreFromHeaders();
  const [catalog, productsResult] = await Promise.all([
    listAdminDroneModelCatalog(store.id),
    listAdminProductsWithSource(store.id),
  ]);
  const productIds = productsResult.data.map((product) => product.id);
  const links = await listProductDroneModelLinks(store.id, productIds);
  const modelBySlug = new Map(
    catalog.flatMap((line) => line.models.map((model) => [model.slug, model]))
  );
  const linksByProductId = new Map<string, string[]>();
  links.forEach((link) => {
    const current = linksByProductId.get(link.productId) ?? [];
    current.push(link.droneModelId);
    linksByProductId.set(link.productId, current);
  });
  const models = catalog.flatMap((line) =>
    line.models.map((model) => ({
      id: model.id,
      label: model.name,
      lineLabel: line.name,
    }))
  );
  const rows = productsResult.data.map((product) => {
    const detected = detectDroneModels(`${product.name} ${product.sku ?? ''}`)
      .map((item) => modelBySlug.get(item.modelSlug)?.id)
      .filter((id): id is string => Boolean(id));

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      status: product.status,
      currentModelIds: linksByProductId.get(product.id) ?? [],
      suggestedModelIds: detected,
    };
  });
  const mappedProducts = rows.filter((row) => row.currentModelIds.length > 0).length;
  const suggestedProducts = rows.filter(
    (row) => row.suggestedModelIds.length > 0 && row.currentModelIds.length === 0
  ).length;

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Modelos compatíveis"
        description="Associação complementar para navegação por drone. Ela não altera a categoria técnica, SKU, preço, estoque ou o cadastro no Bling."
        action={
          <div className="flex items-center gap-2">
            <SettingsBadge tone={productsResult.source === 'supabase' ? 'success' : 'warning'}>
              {productsResult.source === 'supabase' ? 'Catálogo conectado' : 'Modo demonstração'}
            </SettingsBadge>
            <form action={activateDroneModelNavigationAction}>
              <button
                type="submit"
                disabled={mappedProducts === 0}
                title={
                  mappedProducts === 0
                    ? 'Confirme ao menos uma compatibilidade antes de ativar o menu.'
                    : 'Ativar navegação pública por modelos.'
                }
                className="h-8 rounded-lg border border-[#1E3DFF]/35 bg-[#101F43] px-3 text-[11px] font-semibold text-white transition hover:bg-[#1E3DFF]/30 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-[#081225] disabled:text-slate-500"
              >
                Ativar menu de modelos
              </button>
            </form>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border-l-2 border-emerald-400 pl-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Produtos mapeados</p>
            <p className="mt-1 text-xl font-semibold text-white">{mappedProducts}</p>
          </div>
          <div className="border-l-2 border-amber-300 pl-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Para revisar</p>
            <p className="mt-1 text-xl font-semibold text-white">{suggestedProducts}</p>
          </div>
          <div className="border-l-2 border-[#7EC3FF] pl-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Modelos ativos</p>
            <p className="mt-1 text-xl font-semibold text-white">{models.length}</p>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel>
        <CompatibilityManager models={models} products={rows} />
      </SettingsPanel>
    </div>
  );
}
