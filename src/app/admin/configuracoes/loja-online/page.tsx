import {
  Eye,
  EyeOff,
  GripVertical,
  Menu,
  Navigation,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { AdminActionForm } from '@/components/admin/AdminActionForm';
import { AdminDrawer } from '@/components/admin/AdminDrawer';
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
import { moveStorefrontNavigationItemAction, saveStorefrontNavigationAction } from './actions';

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

function HiddenNavigationItem({ item, index }: { item: StorefrontNavigationItem; index: number }) {
  const prefix = `items.${index}`;
  const values: Record<string, string | number | undefined> = {
    id: item.id, label: item.label, type: item.type, categorySlug: item.categorySlug,
    href: item.href, parentId: item.parentId, position: item.position,
  };
  return <>{Object.entries(values).map(([key,value]) => value !== undefined ? <input key={key} type="hidden" name={`${prefix}.${key}`} value={value} /> : null)}{(['enabled','showInNavbar','showInCategoriesDropdown','opensInDropdown'] as const).map((key)=>item[key]?<input key={key} type="hidden" name={`${prefix}.${key}`} value="on"/>:null)}</>;
}

export default async function OnlineStoreSettingsPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const params = await searchParams;
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
  const selectedIndex = items.findIndex((item) => item.id === params.record);
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined;
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

      <SettingsPanel title="Menu público" description="Itens exibidos na navegação da loja. Abra somente o item que deseja alterar.">
        <div className="divide-y divide-white/6 overflow-hidden rounded-lg border border-white/6">
          {items.map((item,index)=><div key={item.id} className="grid gap-3 bg-[#081225] px-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"><div className="flex gap-1"><AdminActionForm action={moveStorefrontNavigationItemAction} successMessage={`${item.label} movido para cima.`} pendingMessage="Reordenando menu…"><input type="hidden" name="itemId" value={item.id}/><input type="hidden" name="direction" value="up"/><button disabled={index===0} aria-label={`Mover ${item.label} para cima`} className="rounded border border-white/8 px-2 py-1 text-slate-400 disabled:opacity-30">↑</button></AdminActionForm><AdminActionForm action={moveStorefrontNavigationItemAction} successMessage={`${item.label} movido para baixo.`} pendingMessage="Reordenando menu…"><input type="hidden" name="itemId" value={item.id}/><input type="hidden" name="direction" value="down"/><button disabled={index===items.length-1} aria-label={`Mover ${item.label} para baixo`} className="rounded border border-white/8 px-2 py-1 text-slate-400 disabled:opacity-30">↓</button></AdminActionForm></div><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-white">{item.label}</span><SettingsBadge tone={item.enabled?'success':'disabled'}>{item.enabled?'Visível':'Oculto'}</SettingsBadge>{countBlingManagedChildren(item,storefrontCategories)>0?<SettingsBadge tone="info">{countBlingManagedChildren(item,storefrontCategories)} subcategorias</SettingsBadge>:null}</div><p className="mt-1 text-[11px] text-slate-500">{item.href??'Grupo sem link direto'} · ordem {item.position}</p></div><Link href={`/admin/configuracoes/loja-online?record=${item.id}`} scroll={false} className="text-xs font-semibold text-blue-300">Editar</Link></div>)}
        </div>
      </SettingsPanel>

      {selectedItem ? <AdminDrawer title={selectedItem.label} description="Edite a exibição, o vínculo e a posição deste item."><AdminActionForm action={saveStorefrontNavigationAction} successMessage="Item do menu salvo com sucesso." pendingMessage="Salvando item do menu…" className="space-y-4"><input type="hidden" name="itemCount" value={items.length}/>{items.map((item,index)=>index===selectedIndex?null:<HiddenNavigationItem key={item.id} item={item} index={index}/>)}<NavigationItemRow item={selectedItem} index={selectedIndex} parentOptions={parentOptions} categoryOptions={categoryOptions} blingManagedChildren={countBlingManagedChildren(selectedItem,storefrontCategories)}/><button type="submit" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"><Save className="h-3.5 w-3.5"/>Salvar item do menu</button></AdminActionForm></AdminDrawer>:null}

      <SettingsPanel title="Categorias do catálogo" description="Categorias disponíveis, sincronizadas do catálogo e separadas da edição do menu.">
        <div className="flex flex-wrap gap-2">{categoryOptions.map((category)=><span key={category.slug} className="rounded-md border border-white/7 bg-[#081225] px-2.5 py-1.5 text-xs text-slate-300">{category.name}</span>)}</div>
      </SettingsPanel>

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
