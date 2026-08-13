import {
  Eye,
  EyeOff,
  GripVertical,
  Menu,
  Navigation,
  Save,
} from 'lucide-react';
import {
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';
import {
  listCategories,
  listStorefrontProducts,
} from '@/modules/catalog/product.service';
import {
  toStorefrontCategories,
} from '@/modules/catalog/storefront-product.adapter';
import {
  getAdminStorefrontNavigation,
  type StorefrontNavigationItem,
} from '@/modules/catalog/storefront-navigation';
import { countBlingManagedChildren } from '@/modules/catalog/storefront-navigation.catalog';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { saveStorefrontNavigationAction } from './actions';

const syntheticCategoryOptions = [
  { name: 'Drones', slug: 'drones' },
  { name: 'Peças', slug: 'pecas' },
  { name: 'Baterias', slug: 'baterias' },
  { name: 'Acessórios', slug: 'acessorios' },
  { name: 'Kits e combos', slug: 'kits-e-combos' },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function mergeNavigationWithAvailableCategories(
  items: StorefrontNavigationItem[],
  categories: Array<{ name: string; slug: string }>
) {
  const existingSlugs = new Set(
    items.map((item) => item.categorySlug).filter(Boolean)
  );
  const existingLabels = new Set(items.map((item) => item.label.toLowerCase()));
  const extraItems = categories
    .filter((category) => {
      return (
        !existingSlugs.has(category.slug) &&
        !existingLabels.has(category.name.toLowerCase())
      );
    })
    .map((category, index): StorefrontNavigationItem => ({
      id: `available-${category.slug}`,
      label: category.name,
      type: 'category',
      categorySlug: category.slug,
      href: `/categoria/${category.slug}`,
      position: 1000 + index * 10,
      enabled: false,
      showInNavbar: false,
      showInCategoriesDropdown: false,
      opensInDropdown: false,
      children: [],
    }));

  return [...items, ...extraItems].sort((left, right) => {
    if (left.position !== right.position) return left.position - right.position;
    return left.label.localeCompare(right.label, 'pt-BR');
  });
}

function ToggleField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-white/6 bg-[#081225] px-2.5 py-2 text-[11px] font-medium text-slate-300">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-3.5 w-3.5 rounded border-white/20 bg-[#050A14] accent-[#1E3DFF]"
      />
      {label}
    </label>
  );
}

function NavigationItemRow({
  item,
  index,
  parentOptions,
  categoryOptions,
  blingManagedChildren,
}: {
  item: StorefrontNavigationItem;
  index: number;
  parentOptions: StorefrontNavigationItem[];
  categoryOptions: Array<{ name: string; slug: string }>;
  blingManagedChildren: number;
}) {
  const prefix = `items.${index}`;
  const active = item.enabled;

  return (
    <section className="min-w-0 rounded-lg border border-white/6 bg-[#081225] p-3">
      <input type="hidden" name={`${prefix}.id`} value={item.id} />
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-[#0A1730] text-slate-300">
                <GripVertical className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <input
                  name={`${prefix}.label`}
                  defaultValue={item.label}
                  className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#050A14] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#1E3DFF]/45"
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  {item.href ?? 'Grupo sem link direto'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {blingManagedChildren > 0 ? (
                <SettingsBadge tone="info">
                  {blingManagedChildren} subcategorias via Bling
                </SettingsBadge>
              ) : null}
              <SettingsBadge tone={active ? 'success' : 'disabled'}>
                {active ? 'Visível' : 'Oculto'}
              </SettingsBadge>
            </div>
          </div>

          <div className="grid min-w-0 gap-2 md:grid-cols-4">
            <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-400">
              Tipo
              <select
                name={`${prefix}.type`}
                defaultValue={item.type}
                className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#050A14] px-3 text-xs text-white outline-none"
              >
                <option value="category">Categoria</option>
                <option value="group">Grupo</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-400 md:col-span-2">
              Categoria vinculada
              <select
                name={`${prefix}.categorySlug`}
                defaultValue={item.categorySlug ?? ''}
                className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#050A14] px-3 text-xs text-white outline-none"
              >
                <option value="">Sem link</option>
                {categoryOptions.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-400">
              Rota interna
              <input
                name={`${prefix}.href`}
                defaultValue={item.href ?? ''}
                placeholder="/modelos/mini-3"
                className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#050A14] px-3 text-xs text-white outline-none"
              />
            </label>

            <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-400">
              Ordem
              <input
                name={`${prefix}.position`}
                type="number"
                min="0"
                step="1"
                defaultValue={item.position}
                className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#050A14] px-3 text-xs text-white outline-none"
              />
            </label>
          </div>
        </div>

        <div className="min-w-0 space-y-3 rounded-lg border border-white/6 bg-[#050A14] p-3">
          <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-400">
            Item pai / submenu
            <select
              name={`${prefix}.parentId`}
              defaultValue={item.parentId ?? ''}
              className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none"
            >
              <option value="">Sem pai</option>
              {parentOptions
                .filter((option) => option.id !== item.id)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleField
              name={`${prefix}.enabled`}
              label="Ativo"
              defaultChecked={item.enabled}
            />
            <ToggleField
              name={`${prefix}.showInNavbar`}
              label="Navbar"
              defaultChecked={item.showInNavbar}
            />
            <ToggleField
              name={`${prefix}.showInCategoriesDropdown`}
              label="Menu Categorias"
              defaultChecked={item.showInCategoriesDropdown}
            />
            <ToggleField
              name={`${prefix}.opensInDropdown`}
              label="Abre submenu"
              defaultChecked={item.opensInDropdown}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function OnlineStoreSettingsPage() {
  const store = await resolveCurrentStoreFromHeaders();
  const [catalogProducts, catalogCategories] = await Promise.all([
    listStorefrontProducts(store.id),
    listCategories(store.id),
  ]);
  const storefrontCategories = toStorefrontCategories(
    catalogCategories,
    catalogProducts
  );
  const navigation = await getAdminStorefrontNavigation(
    store.id,
    storefrontCategories
  );
  const categoryOptions = [
    ...syntheticCategoryOptions,
    ...storefrontCategories.map((category) => ({
      name: category.name,
      slug: category.slug,
    })),
  ].filter((category, index, list) => {
    return list.findIndex((item) => item.slug === category.slug) === index;
  });
  const items = mergeNavigationWithAvailableCategories(
    navigation.adminItems,
    categoryOptions
  );
  const navbarCount = items.filter(
    (item) => item.enabled && item.showInNavbar
  ).length;
  const dropdownCount = items.filter(
    (item) => item.enabled && item.showInCategoriesDropdown
  ).length;
  const visibleCount = items.filter((item) => item.enabled).length;
  const parentOptions = items.filter((item) => {
    return item.opensInDropdown || item.type === 'group' || item.showInNavbar;
  });
  const statCards = [
    { label: 'Itens visíveis', value: visibleCount, icon: Eye },
    { label: 'No navbar', value: navbarCount, icon: Navigation },
    { label: 'Menu Categorias', value: dropdownCount, icon: Menu },
    { label: 'Ocultos', value: Math.max(items.length - visibleCount, 0), icon: EyeOff },
  ];

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Loja online"
        description="Controle a posição e a visibilidade dos itens principais. Subcategorias vinculadas ao catálogo são sincronizadas do Bling."
        action={
          <SettingsBadge tone={navigation.source === 'database' ? 'success' : 'warning'}>
            {navigation.source === 'database' ? 'Configurado' : 'Fallback'}
          </SettingsBadge>
        }
      >
        <div className="grid gap-2 md:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      </SettingsPanel>

      <form action={saveStorefrontNavigationAction} className="space-y-3">
        <input type="hidden" name="itemCount" value={items.length} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#0A1730]/95 p-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Categorias e itens do menu
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Categorias apontam para `/categoria/[slug]`. Itens customizados aceitam somente rotas internas, como `/modelos/mini-3`.
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-4 text-xs font-semibold text-white"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar navegação
          </button>
        </div>

        <div className="grid gap-3">
          {items.map((item, index) => (
            <NavigationItemRow
              key={item.id}
              item={item}
              index={index}
              parentOptions={parentOptions}
              categoryOptions={categoryOptions}
              blingManagedChildren={countBlingManagedChildren(
                item,
                storefrontCategories
              )}
            />
          ))}
        </div>
      </form>

      <SettingsPanel
        title="Como funciona no site"
        description="O menu público combina a configuração editorial com a árvore de categorias sincronizada do ERP."
      >
        <div className="grid gap-2 md:grid-cols-3">
          {[
            'Navbar mostra somente itens ativos marcados para aparecer no topo.',
            'Linhas vinculadas ao Bling recebem automaticamente suas subcategorias e nomes.',
            'Compatibilidade múltipla por modelo continua na Zalen sem trocar a categoria principal do produto no ERP.',
          ].map((item) => (
            <div
              key={item}
              className={cn(
                'rounded-lg border border-white/6 bg-[#081225] p-3 text-xs leading-5 text-slate-300'
              )}
            >
              {item}
            </div>
          ))}
        </div>
      </SettingsPanel>
    </div>
  );
}
