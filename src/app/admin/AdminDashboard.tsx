'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import type {
  Category,
  ProductStatus,
  ProductSummary,
} from '@/modules/catalog/product.types';
import type {
  OrderListItem,
  OrderStatus,
  PaymentStatus,
} from '@/modules/orders/order.types';
import type { PlatformRole, StoreRole } from '@/modules/auth/auth.types';
import type {
  IntegrationProviderCategory,
  IntegrationProviderStatus,
} from '@/modules/integrations/core/integration-provider.types';
import type {
  StoreIntegrationListItem,
  StoreIntegrationStatus,
} from '@/modules/integrations/core/store-integration.types';
import { logoutAction } from '@/app/login/actions';
import {
  updateProductStatusAction,
  updateProductStockAction,
} from '@/app/admin/products/actions';
import { currentStoreBrand } from '@/lib/branding/current-store-brand';
import { platformBrand } from '@/lib/branding/platform-brand';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronRight,
  CreditCard,
  Database,
  Filter,
  Gauge,
  LayoutGrid,
  LifeBuoy,
  MoreHorizontal,
  Package2,
  Pencil,
  Plus,
  RefreshCw,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Truck,
  UserRound,
  Waypoints,
  Wifi,
} from 'lucide-react';

type AdminView = 'dashboard' | 'products' | 'orders' | 'integrations' | 'settings';
type SettingsSection = 'profile' | 'operations' | 'notifications';
type ProductFilter = 'all' | ProductStatus;
type ProductSourceFilter = 'all' | 'zalen' | 'bling';
type OrderFilter = 'all' | OrderStatus;
type AdminAccessRole = PlatformRole | StoreRole;
type AdminDataSource = 'supabase' | 'mock';

interface AdminDashboardProps {
  products: ProductSummary[];
  categories: Category[];
  orders: OrderListItem[];
  integrations: StoreIntegrationListItem[];
  dataSources: {
    products: AdminDataSource;
    categories: AdminDataSource;
    orders: AdminDataSource;
    integrations: AdminDataSource;
  };
  adminUser: {
    email?: string;
    role: AdminAccessRole;
  };
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
});

const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const viewMeta: Record<
  AdminView,
  { eyebrow: string; title: string; description: string }
> = {
  dashboard: {
    eyebrow: 'Operação',
    title: 'Visão geral operacional',
    description:
      'Catálogo, pedidos e prontidão do backoffice.',
  },
  products: {
    eyebrow: 'Catálogo operacional',
    title: 'Produtos e estoque',
    description:
      'Gerencie seu catálogo, preços e estoque.',
  },
  orders: {
    eyebrow: 'Mesa operacional',
    title: 'Pedidos e expedição',
    description:
      'Fluxo do pagamento até a separação.',
  },
  integrations: {
    eyebrow: 'Integrações desacopladas',
    title: 'Integrações',
    description:
      'Conectores disponíveis e status da loja ativa.',
  },
  settings: {
    eyebrow: 'Admin interno',
    title: 'Configurações e operação',
    description:
      'Preferências visuais do painel interno.',
  },
};

const productStatusClass: Record<ProductStatus, string> = {
  active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  inactive: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  draft: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
};

const productStatusLabel: Record<ProductStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  draft: 'Rascunho',
};

const orderStatusClass: Record<OrderStatus, string> = {
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  confirmed: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  processing: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
  shipped: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  delivered: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  cancelled: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
};

const orderStatusLabel: Record<OrderStatus, string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmado',
  processing: 'Separando',
  shipped: 'Postado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const paymentStatusClass: Record<PaymentStatus, string> = {
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  failed: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  refunded: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
};

const providerCategoryLabel: Record<IntegrationProviderCategory, string> = {
  erp: 'ERP',
  payment: 'Pagamento',
  shipping: 'Envio',
  sales_channel: 'Canal',
  ai: 'IA',
  analytics: 'Analytics',
};

const providerStatusLabel: Record<IntegrationProviderStatus, string> = {
  planned: 'Planejado',
  beta: 'Beta',
  available: 'Disponível',
  deprecated: 'Descontinuado',
};

const providerStatusClass: Record<IntegrationProviderStatus, string> = {
  planned: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  beta: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  available: 'border-[#1E3DFF]/30 bg-[#1E3DFF]/10 text-[#A9C7FF]',
  deprecated: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

const storeIntegrationStatusLabel: Record<StoreIntegrationStatus, string> = {
  planned: 'Planejado',
  pending_credentials: 'Credenciais pendentes',
  disconnected: 'Desconectado',
  connected: 'Conectado',
  error: 'Erro',
  syncing: 'Sincronizando',
  disabled: 'Desabilitado',
};

const storeIntegrationStatusClass: Record<StoreIntegrationStatus, string> = {
  planned: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  pending_credentials: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  disconnected: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  connected: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  syncing: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  disabled: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

const accessRoleLabel: Record<AdminAccessRole, string> = {
  platform_owner: 'Zalen owner',
  platform_admin: 'Zalen admin',
  store_owner: 'Dono da loja',
  store_admin: 'Admin da loja',
  store_operator: 'Operador',
  store_viewer: 'Leitor',
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatCompact(value: number) {
  return compactNumberFormatter.format(value);
}

function formatShortDate(value: string) {
  return shortDateFormatter.format(new Date(value));
}

function formatDateTime(value: string) {
  return longDateFormatter.format(new Date(value));
}

function initialsFromName(name?: string) {
  if (!name) return 'BD';

  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function initialsFromEmail(email?: string) {
  if (!email) return 'AD';

  const [localPart] = email.split('@');
  return initialsFromName(localPart.replace(/[._-]+/g, ' '));
}

function matchesSearch(tokens: Array<string | undefined>, query: string) {
  if (!query) return true;

  const normalizedQuery = query.trim().toLowerCase();
  return tokens.some((token) => token?.toLowerCase().includes(normalizedQuery));
}

function productSku(product: ProductSummary) {
  const brandPrefix = product.brand
    ?.replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase();
  const slugPrefix = product.slug
    .split('-')
    .map((part) => part.slice(0, 4).toUpperCase())
    .join('-')
    .slice(0, 16);

  return [brandPrefix, slugPrefix].filter(Boolean).join('-');
}

function productSourceLabel(product: ProductSummary) {
  return product.externalProvider === 'bling' ? 'Bling' : 'Zalen';
}

function productSourceValue(product: ProductSummary): Exclude<ProductSourceFilter, 'all'> {
  return product.externalProvider === 'bling' ? 'bling' : 'zalen';
}

function productSourceClass(product: ProductSummary) {
  return product.externalProvider === 'bling'
    ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
    : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';
}

function productMatchKey(product: ProductSummary) {
  return product.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function sourceLabel(source: AdminDataSource) {
  return source === 'supabase' ? 'Supabase' : 'Mock';
}

function isAdminView(value: string | null): value is AdminView {
  return (
    value === 'dashboard' ||
    value === 'products' ||
    value === 'orders' ||
    value === 'integrations' ||
    value === 'settings'
  );
}

function integrationStatusLabel(item: StoreIntegrationListItem) {
  return item.integration
    ? storeIntegrationStatusLabel[item.integration.status]
    : providerStatusLabel[item.provider.status];
}

function integrationStatusClass(item: StoreIntegrationListItem) {
  return item.integration
    ? storeIntegrationStatusClass[item.integration.status]
    : providerStatusClass[item.provider.status];
}

function integrationActionLabel(item: StoreIntegrationListItem) {
  if (item.integration?.status === 'connected') {
    return 'Ver detalhes';
  }

  if (item.provider.key === 'bling') {
    return 'Conectar Bling';
  }

  if (!item.integration && item.provider.status === 'planned') {
    return 'Em breve';
  }

  return 'Preparar conexão';
}

function integrationActionHref(item: StoreIntegrationListItem) {
  if (item.provider.key === 'bling') {
    return '/admin/integracoes/bling';
  }

  return null;
}

function integrationLastSyncLabel(item: StoreIntegrationListItem) {
  if (!item.integration?.lastSyncAt) {
    return 'Sem sync';
  }

  return formatDateTime(item.integration.lastSyncAt);
}

function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-white/6 bg-[#0A1730]/95 shadow-[0_14px_34px_rgba(0,0,0,0.22)]',
        className
      )}
    >
      {(title || description || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/6 px-4 py-3">
          <div className="space-y-1">
            {title ? <h3 className="text-sm font-semibold text-white">{title}</h3> : null}
            {description ? (
              <p className="max-w-2xl text-xs text-slate-400">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-[linear-gradient(180deg,rgba(13,26,54,0.98),rgba(9,19,39,0.98))] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#091427] text-[#5BCBFF]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
      <p className="mt-1 truncate text-[11px] text-slate-500">{helper}</p>
    </div>
  );
}

function SmallBadge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold', className)}>
      {children}
    </span>
  );
}

function InlineSubmitButton({ idleLabel = 'Salvar' }: { idleLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 min-w-16 items-center justify-center rounded-md border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A9C7FF] transition hover:border-[#1E3DFF]/40 hover:text-white disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? 'Salvando' : idleLabel}
    </button>
  );
}

function ProductStatusForm({ product }: { product: ProductSummary }) {
  return (
    <form action={updateProductStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={product.id} />
      <select
        name="status"
        defaultValue={product.status}
        aria-label={`Status de ${product.name}`}
        className={cn(
          'h-8 rounded-md border px-2.5 text-[11px] font-semibold outline-none transition',
          productStatusClass[product.status],
          'min-w-[104px] appearance-none'
        )}
      >
        {Object.entries(productStatusLabel).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <InlineSubmitButton />
    </form>
  );
}

function ProductStockForm({ product }: { product: ProductSummary }) {
  return (
    <form action={updateProductStockAction} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={product.id} />
      <input
        type="number"
        name="stock"
        min={0}
        defaultValue={product.stock}
        aria-label={`Estoque de ${product.name}`}
        className="h-8 w-20 rounded-md border border-white/8 bg-[#081225] px-2.5 text-[11px] font-semibold text-white outline-none transition [appearance:textfield] placeholder:text-slate-500 focus:border-[#1E3DFF]/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <InlineSubmitButton />
    </form>
  );
}

function GaugeCard({
  value,
  segments,
  centerLabel,
  items,
}: {
  value: string;
  segments: Array<{ color: string; portion: number }>;
  centerLabel: string;
  items: Array<{ label: string; value: string; dot: string }>;
}) {
  const stops: string[] = [];
  let cursor = 0;

  segments.forEach((segment) => {
    const end = cursor + segment.portion * 360;
    stops.push(`${segment.color} ${cursor}deg ${end}deg`);
    cursor = end;
  });

  if (cursor < 360) {
    stops.push(`#10203F ${cursor}deg 360deg`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[150px,1fr] xl:items-center">
      <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-white/6 bg-[#071124]">
        <div
          className="relative flex h-28 w-28 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${stops.join(', ')})`,
          }}
        >
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[#071124] text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
            <span className="text-xl font-semibold text-white">{value}</span>
            <span className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-slate-500">
              {centerLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg border border-white/6 bg-[#091427] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.dot }} />
              <span className="text-xs text-slate-300">{item.label}</span>
            </div>
            <span className="text-xs font-semibold text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendBars({
  series,
}: {
  series: Array<{ label: string; primary: number; secondary: number }>;
}) {
  const maxValue = Math.max(
    1,
    ...series.flatMap((point) => [point.primary, point.secondary])
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {series.map((point) => (
          <div key={point.label} className="flex h-32 flex-col justify-end gap-2">
            <div className="relative flex h-full items-end gap-1.5 rounded-lg border border-white/6 bg-[linear-gradient(180deg,rgba(7,17,36,0.25),rgba(7,17,36,0.8))] px-3 pb-3 pt-4">
              <div
                className="w-1/2 rounded-full bg-[linear-gradient(180deg,#1E3DFF,#38BDF8)] shadow-[0_0_24px_rgba(30,61,255,0.28)]"
                style={{ height: `${(point.primary / maxValue) * 100}%` }}
              />
              <div
                className="w-1/2 rounded-full bg-[linear-gradient(180deg,#00E676,#0EA5E9)] shadow-[0_0_24px_rgba(0,230,118,0.2)]"
                style={{ height: `${(point.secondary / maxValue) * 100}%` }}
              />
            </div>
            <div className="text-center text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {point.label}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#38BDF8]" />
          Receita total
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00E676]" />
          Valor em produtos
        </div>
      </div>
    </div>
  );
}

function SettingsField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2 border-b border-white/6 py-2.5 last:border-b-0 md:grid-cols-[130px,1fr] md:items-center">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <div className="rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs text-slate-200">
        {value}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  products,
  categories,
  orders,
  integrations,
  dataSources,
  adminUser,
}: AdminDashboardProps) {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view');
  const [activeView, setActiveView] = useState<AdminView>(() =>
    isAdminView(requestedView) ? requestedView : 'dashboard'
  );
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productSourceFilter, setProductSourceFilter] =
    useState<ProductSourceFilter>('all');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  const searchValue = searchQuery.trim().toLowerCase();

  const activeProducts = products.filter((product) => product.status === 'active');
  const draftProducts = products.filter((product) => product.status === 'draft');
  const inactiveProducts = products.filter((product) => product.status === 'inactive');
  const lowStockProducts = products.filter((product) => product.stock <= 3);
  const nativeProducts = products.filter(
    (product) => productSourceValue(product) === 'zalen'
  );
  const blingProducts = products.filter(
    (product) => productSourceValue(product) === 'bling'
  );
  const nativeProductKeys = new Set(
    nativeProducts.map(productMatchKey).filter(Boolean)
  );
  const blingProductKeys = new Set(
    blingProducts.map(productMatchKey).filter(Boolean)
  );
  const potentialDuplicateKeys = new Set(
    Array.from(nativeProductKeys).filter((key) => blingProductKeys.has(key))
  );
  const potentialDuplicateProductIds = new Set(
    products
      .filter((product) => potentialDuplicateKeys.has(productMatchKey(product)))
      .map((product) => product.id)
  );
  const potentialDuplicateGroups = Array.from(potentialDuplicateKeys)
    .map((key) => ({
      key,
      products: products.filter((product) => productMatchKey(product) === key),
    }))
    .filter((group) => group.products.length > 1);
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const processingOrders = orders.filter(
    (order) => order.status === 'confirmed' || order.status === 'processing'
  );
  const shippedOrders = orders.filter((order) => order.status === 'shipped');
  const paidOrders = orders.filter((order) => order.paymentStatus === 'paid');
  const syncedOrders = orders.filter((order) => order.externalErpId);
  const connectedIntegrations = integrations.filter(
    (item) => item.integration?.status === 'connected'
  );
  const erroredIntegrations = integrations.filter(
    (item) => item.integration?.status === 'error'
  );
  const plannedIntegrations = integrations.filter(
    (item) => !item.integration && item.provider.status === 'planned'
  );
  const primaryErpIntegration =
    integrations.find((item) => item.provider.key === 'bling') ??
    integrations.find((item) => item.provider.category === 'erp');
  const blingLastSyncAt = integrations.find(
    (item) => item.provider.key === 'bling'
  )?.integration?.lastSyncAt;

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const averageTicket = orders.length > 0 ? totalRevenue / orders.length : 0;
  const totalProductsValue = products.reduce(
    (sum, product) => sum + product.price,
    0
  );
  const totalInventoryUnits = products.reduce(
    (sum, product) => sum + product.stock,
    0
  );
  const outOfStockProducts = products.filter((product) => product.stock === 0);

  const categoryLoad = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      count: products.filter((product) =>
        product.categories.some((productCategory) => productCategory.slug === category.slug)
      ).length,
      units: products
        .filter((product) =>
          product.categories.some((productCategory) => productCategory.slug === category.slug)
        )
        .reduce((sum, product) => sum + product.stock, 0),
      lowStockCount: products.filter(
        (product) =>
          product.stock <= 3 &&
          product.categories.some((productCategory) => productCategory.slug === category.slug)
      ).length,
    }))
    .sort((left, right) => right.units - left.units || right.count - left.count);
  const largestCategoryUnits = Math.max(
    1,
    ...categoryLoad.map((category) => category.units)
  );

  const revenueSeriesBase = orders
    .slice()
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )
      .map((order) => ({
        label: formatShortDate(order.createdAt),
        primary: order.total,
        secondary: order.items.reduce((sum, item) => sum + item.total, 0),
      }));

  const revenueSeries =
    revenueSeriesBase.length >= 5
      ? revenueSeriesBase.slice(-5)
      : [
          ...Array.from({ length: Math.max(0, 5 - revenueSeriesBase.length) }, (_, index) => ({
            label: `Slot ${index + 1}`,
            primary: 0,
            secondary: 0,
          })),
          ...revenueSeriesBase,
        ];

  const filteredProducts = products.filter((product) => {
    const statusMatches = productFilter === 'all' || product.status === productFilter;
    const categoryMatches =
      productCategoryFilter === 'all' ||
      product.categories.some((category) => category.slug === productCategoryFilter);
    const sourceMatches =
      productSourceFilter === 'all' ||
      productSourceValue(product) === productSourceFilter;
    const textMatches = matchesSearch(
      [
        product.name,
        product.slug,
        product.brand,
        productSku(product),
        productSourceLabel(product),
        ...product.categories.map((category) => category.name),
      ],
      searchValue
    );

    return statusMatches && categoryMatches && sourceMatches && textMatches;
  });

  const filteredOrders = orders.filter((order) => {
    const statusMatches = orderFilter === 'all' || order.status === orderFilter;
    const textMatches = matchesSearch(
      [
        order.orderNumber,
        order.customerName,
        order.customerEmail,
        order.salesChannel,
      ],
      searchValue
    );

    return statusMatches && textMatches;
  });

  const sidebarItems: Array<{
    id: AdminView;
    label: string;
    icon: ComponentType<{ className?: string }>;
    count: string;
    href?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Visão geral',
      icon: LayoutGrid,
      count: '01',
    },
    {
      id: 'products',
      label: 'Produtos',
      icon: Package2,
      count: String(products.length).padStart(2, '0'),
    },
    {
      id: 'orders',
      label: 'Pedidos',
      icon: ShoppingCart,
      count: String(orders.length).padStart(2, '0'),
    },
    {
      id: 'integrations',
      label: 'Integrações',
      icon: Waypoints,
      count: String(integrations.length).padStart(2, '0'),
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings2,
      count: '02',
      href: '/admin/configuracoes',
    },
  ];

  const view = viewMeta[activeView];
  const adminInitials = initialsFromEmail(adminUser.email);
  const adminEmail = adminUser.email ?? 'admin autenticado';
  const adminRoleLabel = accessRoleLabel[adminUser.role];
  const productsSourceLabel = sourceLabel(dataSources.products);
  const categoriesSourceLabel = sourceLabel(dataSources.categories);
  const ordersSourceLabel = sourceLabel(dataSources.orders);
  const integrationsSourceLabel = sourceLabel(dataSources.integrations);
  const catalogSourceLabel =
    dataSources.products === 'supabase' || dataSources.categories === 'supabase'
      ? 'Supabase'
      : 'Mock';

  const renderDashboard = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={Gauge}
          label="Receita monitorada"
          value={formatCurrency(totalRevenue)}
          helper={`${orders.length} pedidos via ${ordersSourceLabel}.`}
        />
        <MetricCard
          icon={Package2}
          label="Produtos ativos"
          value={String(activeProducts.length)}
          helper={`${lowStockProducts.length} item(ns) pedem reposição.`}
        />
        <MetricCard
          icon={CreditCard}
          label="Ticket médio"
          value={formatCurrency(averageTicket)}
          helper={`Base de pedidos: ${ordersSourceLabel}.`}
        />
        <MetricCard
          icon={Truck}
          label="Fila de expedição"
          value={String(processingOrders.length + shippedOrders.length)}
          helper="Pedidos em separação ou já postados."
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.45fr,0.95fr]">
        <Panel
          title="Receita por movimentação"
          description={`Leitura operacional da base de pedidos via ${ordersSourceLabel}.`}
          action={
            <SmallBadge className="border-[#1E3DFF]/30 bg-[#1E3DFF]/10 text-[#8DB6FF]">
              {ordersSourceLabel}
            </SmallBadge>
          }
        >
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold text-white">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {paidOrders.length} pedidos com pagamento confirmado.
              </div>
            </div>
            <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Média por item
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {formatCurrency(totalProductsValue / Math.max(products.length, 1))}
              </div>
            </div>
          </div>
          <TrendBars series={revenueSeries} />
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Mix do catálogo"
            description={`Distribuição das categorias lidas via ${categoriesSourceLabel}.`}
          >
            <GaugeCard
              value={String(categories.length)}
              centerLabel="Categorias"
              segments={[
                { color: '#38BDF8', portion: 0.42 },
                { color: '#1E3DFF', portion: 0.33 },
                { color: '#00E676', portion: 0.15 },
              ]}
              items={categoryLoad.slice(0, 3).map((item, index) => ({
                label: item.name,
                value: `${item.count} produto(s)`,
                dot: ['#38BDF8', '#1E3DFF', '#00E676'][index] ?? '#94A3B8',
              }))}
            />
          </Panel>

          <Panel
            title="Alertas do painel"
            description="Fila rápida do que exige ação visual agora."
          >
            <div className="space-y-2">
              <div className="rounded-lg border border-amber-400/15 bg-amber-400/8 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-amber-200">
                      Aprovar pagamentos
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {pendingOrders.length} pedido(s) ainda estão aguardando confirmação.
                    </div>
                  </div>
                  <Bell className="h-4 w-4 text-amber-300" />
                </div>
              </div>

              <div className="rounded-lg border border-[#1E3DFF]/20 bg-[#1E3DFF]/8 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[#9CC0FF]">
                      Separar expedição
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {processingOrders.length} pedido(s) já pagos seguem na mesa de separação.
                    </div>
                  </div>
                  <Boxes className="h-4 w-4 text-[#7EC3FF]" />
                </div>
              </div>

              <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-emerald-200">
                      Catálogo pronto
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {activeProducts.length} produtos ativos já abastecem as rotas públicas.
                    </div>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.35fr,0.95fr]">
        <Panel
          title="Pedidos recentes"
          description={`Leitura compacta da base de pedidos via ${ordersSourceLabel}.`}
          action={
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-[#081225] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#1E3DFF]/30 hover:text-white"
            >
              Abrir mesa
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          }
        >
          <div className="overflow-hidden rounded-lg border border-white/6">
            <div className="grid grid-cols-[1.2fr,1fr,0.8fr,0.8fr] gap-3 bg-[#081225] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Status</span>
              <span className="text-right">Total</span>
            </div>
            {orders.slice(0, 4).map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1.2fr,1fr,0.8fr,0.8fr] gap-3 border-t border-white/6 px-3 py-2.5 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{order.orderNumber}</div>
                  <div className="mt-1 text-slate-400">{formatDateTime(order.createdAt)}</div>
                </div>
                <div>
                  <div className="font-medium text-slate-100">
                    {order.customerName ?? 'Cliente não identificado'}
                  </div>
                  <div className="mt-1 text-slate-400">{order.salesChannel}</div>
                </div>
                <div className="flex items-start">
                  <SmallBadge className={orderStatusClass[order.status]}>
                    {orderStatusLabel[order.status]}
                  </SmallBadge>
                </div>
                <div className="text-right font-semibold text-white">
                  {formatCurrency(order.total)}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Produtos em destaque"
          description="Seleção rápida do catálogo com preço e estoque para checagem visual."
        >
          <div className="space-y-2">
            {products.slice(0, 5).map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2"
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1E3DFF,#38BDF8)] text-xs font-semibold text-white">
                    {initialsFromName(product.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{product.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">
                    {product.categories.map((category) => category.name).join(' • ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {formatCurrency(product.promotionalPrice ?? product.price)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Estoque: {product.stock}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );

  const renderProducts = () => {
    const statusTabs: Array<{ filter: ProductFilter; label: string; count: number }> = [
      { filter: 'all', label: 'Todos', count: products.length },
      { filter: 'active', label: 'Ativo', count: activeProducts.length },
      { filter: 'draft', label: 'Rascunho', count: draftProducts.length },
      { filter: 'inactive', label: 'Inativo', count: inactiveProducts.length },
    ];
    const featuredLowStockProduct = lowStockProducts[0];
    const hasActiveProductFilters =
      productFilter !== 'all' ||
      productCategoryFilter !== 'all' ||
      productSourceFilter !== 'all' ||
      searchValue.length > 0;
    const activeCategory = categories.find(
      (category) => category.slug === productCategoryFilter
    );
    const sourceFilterLabel =
      productSourceFilter === 'bling'
        ? 'Fonte Bling'
        : productSourceFilter === 'zalen'
          ? 'Fonte Zalen'
          : 'Todas as fontes';

    return (
      <div className="space-y-4">
        <Panel
          title="Resumo do catálogo"
          description="Leitura operacional compacta para catálogo, estoque e prioridade de conferência."
          action={
            <div className="flex flex-wrap gap-1.5">
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                {catalogSourceLabel}
              </SmallBadge>
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                Loja ativa: {currentStoreBrand.shortName}
              </SmallBadge>
            </div>
          }
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_300px]">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  icon: Package2,
                  label: 'Itens no painel',
                  value: String(products.length),
                  helper: 'Catálogo pronto para consulta.',
                },
                {
                  icon: Activity,
                  label: 'Ativos',
                  value: String(activeProducts.length),
                  helper: 'Produtos já visíveis na loja.',
                },
                {
                  icon: Boxes,
                  label: 'Unidades em estoque',
                  value: formatCompact(totalInventoryUnits),
                  helper: `${outOfStockProducts.length} item(ns) zerados.`,
                },
                {
                  icon: LifeBuoy,
                  label: 'Baixo estoque',
                  value: String(lowStockProducts.length),
                  helper: 'Prioridade para conferência.',
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/6 bg-[#081225] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-medium text-slate-400">
                        {item.label}
                      </div>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#091427] text-[#7EC3FF]">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.helper}</div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-white/6 bg-[linear-gradient(135deg,rgba(16,31,67,0.9),rgba(8,18,37,0.96))] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#7EC3FF]">
                    Estoque editável
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    Controle direto pela tabela
                  </div>
                </div>
                <SmallBadge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                  Inline
                </SmallBadge>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-300">
                Status e estoque continuam operáveis na própria lista, sem abrir telas
                intermediárias.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Categoria focada
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {activeCategory?.name ?? 'Todas as categorias'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Preço médio
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {formatCurrency(totalProductsValue / Math.max(products.length, 1))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.55fr)_320px]">
          <Panel
            title="Lista de produtos"
            description="Tabela enxuta para busca, filtro e atualização de catálogo."
            action={
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 py-2 text-xs font-semibold text-white opacity-80"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar produto
              </button>
            }
          >
            <div className="space-y-4">
              <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_180px_140px_160px_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar produto, SKU ou categoria..."
                    className="h-10 w-full rounded-lg border border-white/8 bg-[#081225] pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-[#1E3DFF]/35"
                  />
                </label>

                <label className="block rounded-lg border border-white/8 bg-[#081225] px-3 py-1.5">
                  <span className="block text-[10px] text-slate-500">Categoria</span>
                  <select
                    value={productCategoryFilter}
                    onChange={(event) => setProductCategoryFilter(event.target.value)}
                    className="mt-0.5 h-6 w-full bg-transparent text-xs font-semibold text-slate-100 outline-none"
                  >
                    <option value="all">Todas</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block rounded-lg border border-white/8 bg-[#081225] px-3 py-1.5">
                  <span className="block text-[10px] text-slate-500">Fonte</span>
                  <select
                    value={productSourceFilter}
                    onChange={(event) =>
                      setProductSourceFilter(event.target.value as ProductSourceFilter)
                    }
                    className="mt-0.5 h-6 w-full bg-transparent text-xs font-semibold text-slate-100 outline-none"
                  >
                    <option value="all">Todas</option>
                    <option value="zalen">Zalen</option>
                    <option value="bling">Bling</option>
                  </select>
                </label>

                <label className="block rounded-lg border border-white/8 bg-[#081225] px-3 py-1.5">
                  <span className="block text-[10px] text-slate-500">Status</span>
                  <select
                    value={productFilter}
                    onChange={(event) => setProductFilter(event.target.value as ProductFilter)}
                    className="mt-0.5 h-6 w-full bg-transparent text-xs font-semibold text-slate-100 outline-none"
                  >
                    {statusTabs.map((tab) => (
                      <option key={tab.filter} value={tab.filter}>
                        {tab.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setProductCategoryFilter('all');
                    setProductSourceFilter('all');
                    setProductFilter('all');
                  }}
                  disabled={!hasActiveProductFilters}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs font-semibold text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Limpar filtros
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {statusTabs.map((tab) => (
                    <button
                      key={tab.filter}
                      type="button"
                      onClick={() => setProductFilter(tab.filter)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                        productFilter === tab.filter
                          ? 'border-[#1E3DFF]/35 bg-[#1E3DFF]/12 text-[#A9C7FF]'
                          : 'border-white/8 bg-[#081225] text-slate-400 hover:text-slate-200'
                      )}
                    >
                      {tab.label}
                      <span className="text-[10px] opacity-80">{tab.count}</span>
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-slate-400">
                  {filteredProducts.length} resultado(s) ·{' '}
                  {activeCategory?.name ?? 'Todas as categorias'} · {sourceFilterLabel}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/6">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[minmax(300px,1.5fr)_160px_150px_190px_210px_92px] gap-3 bg-[#081225] px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <span>Produto</span>
                    <span>Categoria</span>
                    <span>Preço</span>
                    <span>Estoque</span>
                    <span>Status</span>
                    <span className="text-right">Ações</span>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="px-4 py-10 text-center text-xs text-slate-400">
                      Nenhum produto encontrado com os filtros atuais.
                    </div>
                  ) : null}

                  {filteredProducts.map((product) => {
                    const primaryCategory = product.categories[0];
                    const extraCategoriesCount = Math.max(0, product.categories.length - 1);
                    const priceValue = product.promotionalPrice ?? product.price;
                    const hasPotentialDuplicate =
                      potentialDuplicateProductIds.has(product.id);

                    return (
                      <div
                        key={product.id}
                        className="grid grid-cols-[minmax(300px,1.5fr)_160px_150px_190px_210px_92px] items-center gap-3 border-t border-white/6 px-4 py-3 text-xs transition hover:bg-white/[0.015]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-11 w-11 rounded-lg border border-white/8 object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/8 bg-[linear-gradient(135deg,#1E3DFF,#38BDF8)] text-xs font-semibold text-white">
                              {initialsFromName(product.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-white">
                              {product.name}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span>SKU: {productSku(product)}</span>
                              {product.brand ? <span>Marca: {product.brand}</span> : null}
                              <SmallBadge className={productSourceClass(product)}>
                                Fonte: {productSourceLabel(product)}
                              </SmallBadge>
                              {hasPotentialDuplicate ? (
                                <SmallBadge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
                                  Possível duplicado
                                </SmallBadge>
                              ) : null}
                              {product.externalProvider === 'bling' && blingLastSyncAt ? (
                                <span>Sync: {formatDateTime(blingLastSyncAt)}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0">
                          {primaryCategory ? (
                            <div className="space-y-1">
                              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                                {primaryCategory.name}
                              </SmallBadge>
                              {extraCategoriesCount > 0 ? (
                                <div className="text-[11px] text-slate-500">
                                  +{extraCategoriesCount} categoria(s)
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">Sem categoria</span>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-slate-100">
                            {formatCurrency(priceValue)}
                          </div>
                          {product.promotionalPrice ? (
                            <div className="mt-1 text-[11px] text-slate-500 line-through">
                              {formatCurrency(product.price)}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-500">Preço base</div>
                          )}
                        </div>

                        <ProductStockForm product={product} />

                        <ProductStatusForm product={product} />

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/8 bg-[#081225] text-slate-300 transition hover:border-[#1E3DFF]/35 hover:text-white"
                            aria-label={`Editar ${product.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/8 bg-[#081225] text-slate-300 transition hover:border-[#1E3DFF]/35 hover:text-white"
                            aria-label={`Mais ações para ${product.name}`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                <span>
                  Mostrando {filteredProducts.length} de {products.length} produtos ·{' '}
                  {lowStockProducts.length} com estoque baixo
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md border border-white/8 bg-[#081225] text-slate-500"
                  >
                    ‹
                  </button>
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-[#1E3DFF]/35 bg-[#1E3DFF]/12 px-2 text-xs font-semibold text-[#A9C7FF]">
                    1
                  </span>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md border border-white/8 bg-[#081225] text-slate-500"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel
              title="Conciliação Zalen/Bling"
              description="Produtos manuais são preservados; revise duplicidades antes de vincular ou arquivar."
            >
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-200">
                    Zalen
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {nativeProducts.length}
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-400/15 bg-cyan-400/8 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-200">
                    Bling
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {blingProducts.length}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-400/15 bg-amber-400/8 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-amber-200">
                    Revisar
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {potentialDuplicateGroups.length}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {potentialDuplicateGroups.length > 0 ? (
                  potentialDuplicateGroups.slice(0, 4).map((group) => (
                    <div
                      key={group.key}
                      className="rounded-lg border border-amber-400/15 bg-[#081225] px-3 py-2.5"
                    >
                      <div className="truncate text-xs font-semibold text-white">
                        {group.products[0]?.name ?? group.key}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                        {group.products.map((product) => (
                          <SmallBadge
                            key={product.id}
                            className={productSourceClass(product)}
                          >
                            {productSourceLabel(product)}
                          </SmallBadge>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-3 py-2.5 text-xs text-emerald-200">
                    Nenhum par Zalen/Bling com mesmo nome na lista atual.
                  </div>
                )}
              </div>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-500"
                >
                  Vincular ao Bling em breve
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-500"
                >
                  Arquivar manual em breve
                </button>
              </div>
            </Panel>

            <Panel
              title="Categorias"
              description={`Bloco separado para distribuição de produtos e unidades via ${categoriesSourceLabel}.`}
            >
              <div className="space-y-3">
                {categoryLoad.slice(0, 6).map((category) => (
                  <div key={category.id} className="space-y-2 rounded-lg border border-white/6 bg-[#081225] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white">
                          {category.name}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {category.count} produto(s) · {category.units} unidade(s)
                        </div>
                      </div>
                      <SmallBadge
                        className={
                          category.lowStockCount > 0
                            ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                            : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                        }
                      >
                        {category.lowStockCount > 0
                          ? `${category.lowStockCount} crítico(s)`
                          : 'OK'}
                      </SmallBadge>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/6">
                      <div
                        className="h-1.5 rounded-full bg-[linear-gradient(90deg,#1E3DFF,#38BDF8)]"
                        style={{
                          width: `${Math.max(
                            8,
                            (category.units / largestCategoryUnits) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Reposição visual"
              description="Card pequeno com a fila prioritária de conferência."
            >
              {featuredLowStockProduct ? (
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 3).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-lg border border-amber-400/15 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(8,18,37,0.95))] px-3 py-2.5"
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-10 w-10 rounded-lg border border-white/8 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/8 bg-[linear-gradient(135deg,#1E3DFF,#38BDF8)] text-xs font-semibold text-white">
                          {initialsFromName(product.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">
                          {product.name}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-300">
                          Estoque atual: {product.stock} unidade(s)
                        </div>
                      </div>
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 text-xs font-semibold text-amber-200">
                        {product.stock}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-3 py-2.5 text-xs text-emerald-200">
                  Nenhum item em faixa crítica na base atual.
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    );
  };

  const renderOrders = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={ShoppingCart}
          label="Pedidos no painel"
          value={String(orders.length)}
          helper={`Mesa operacional via ${ordersSourceLabel}.`}
        />
        <MetricCard
          icon={CreditCard}
          label="Aguardando pagamento"
          value={String(pendingOrders.length)}
          helper="Pedidos que dependem de confirmação antes da expedição."
        />
        <MetricCard
          icon={Boxes}
          label="Em separação"
          value={String(processingOrders.length)}
          helper="Pedidos pagos já em andamento no fluxo de estoque."
        />
        <MetricCard
          icon={Truck}
          label="Postados"
          value={String(shippedOrders.length)}
          helper="Pedidos já liberados para entrega."
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.38fr,0.92fr]">
        <Panel
          title="Mesa de pedidos"
          description="Tabela principal de operação diária com leitura rápida de cliente, canal, pagamento e entrega."
          action={
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'] as OrderFilter[]).map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setOrderFilter(filter)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition',
                      orderFilter === filter
                        ? 'border-[#1E3DFF]/35 bg-[#1E3DFF]/12 text-[#A9C7FF]'
                        : 'border-white/8 bg-[#081225] text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {filter === 'all' ? 'Todos' : orderStatusLabel[filter]}
                  </button>
                )
              )}
            </div>
          }
        >
          <div className="overflow-hidden rounded-lg border border-white/6">
            <div className="grid grid-cols-[1fr,1fr,0.7fr,0.8fr,0.75fr] gap-3 bg-[#081225] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Itens</span>
              <span>Status</span>
              <span className="text-right">Total</span>
            </div>
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1fr,1fr,0.7fr,0.8fr,0.75fr] gap-3 border-t border-white/6 px-3 py-2.5 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{order.orderNumber}</div>
                  <div className="mt-1 text-slate-400">{formatDateTime(order.createdAt)}</div>
                </div>
                <div>
                  <div className="font-medium text-slate-100">
                    {order.customerName ?? 'Cliente não identificado'}
                  </div>
                  <div className="mt-1 text-slate-400">
                    {order.salesChannel ?? 'Canal local'}
                  </div>
                </div>
                <div className="text-slate-200">{order.items.length} item(ns)</div>
                <div className="space-y-1">
                  <SmallBadge className={orderStatusClass[order.status]}>
                    {orderStatusLabel[order.status]}
                  </SmallBadge>
                  <div>
                    <SmallBadge className={paymentStatusClass[order.paymentStatus]}>
                      {paymentStatusLabel[order.paymentStatus]}
                    </SmallBadge>
                  </div>
                </div>
                <div className="text-right font-semibold text-white">
                  {formatCurrency(order.total)}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Fila operacional"
            description="Quebra rápida do que o time precisa movimentar agora."
          >
            <div className="space-y-2">
              <div className="rounded-lg border border-amber-400/15 bg-amber-400/8 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">Aprovar pagamentos</div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {pendingOrders.length} pedido(s) aguardando aprovação.
                    </div>
                  </div>
                  <SmallBadge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
                    Hoje
                  </SmallBadge>
                </div>
              </div>

              <div className="rounded-lg border border-[#1E3DFF]/20 bg-[#1E3DFF]/8 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">Separar expedição</div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {processingOrders.length} pedido(s) já pagos na mesa de picking.
                    </div>
                  </div>
                  <SmallBadge className="border-[#1E3DFF]/30 bg-[#1E3DFF]/10 text-[#9CC0FF]">
                    Hoje
                  </SmallBadge>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-400/15 bg-cyan-400/8 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">Postados hoje</div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {shippedOrders.length} pedido(s) já seguiram para entrega.
                    </div>
                  </div>
                  <SmallBadge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                    Atual
                  </SmallBadge>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Canais de venda"
            description={`Distribuição dos pedidos por origem via ${ordersSourceLabel}.`}
          >
            <div className="space-y-2">
              {Array.from(
                orders.reduce((accumulator, order) => {
                  const channel = order.salesChannel ?? 'Canal não informado';
                  accumulator.set(channel, (accumulator.get(channel) ?? 0) + 1);
                  return accumulator;
                }, new Map<string, number>())
              ).map(([channel, count]) => (
                <div
                  key={channel}
                  className="flex items-center justify-between rounded-lg border border-white/6 bg-[#081225] px-3 py-2"
                >
                  <span className="text-xs font-medium text-slate-100">{channel}</span>
                  <span className="text-[11px] text-slate-400">{count} pedido(s)</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={Database}
          label="Providers globais"
          value={String(integrations.length)}
          helper={`Registry carregado via ${integrationsSourceLabel}.`}
        />
        <MetricCard
          icon={Wifi}
          label="Conectados"
          value={String(connectedIntegrations.length)}
          helper="Somente conexões por loja com status ativo."
        />
        <MetricCard
          icon={RefreshCw}
          label="Planejados"
          value={String(plannedIntegrations.length)}
          helper="Sem token, webhook ou chamada externa."
        />
        <MetricCard
          icon={ShieldCheck}
          label="Alertas"
          value={String(erroredIntegrations.length)}
          helper="Erros reportados por store_integrations."
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.85fr,1.35fr]">
        <Panel
          title="ERP principal"
          description="Conector previsto para a operação da Brasil Drones."
          action={
            primaryErpIntegration ? (
              <SmallBadge className={integrationStatusClass(primaryErpIntegration)}>
                {integrationStatusLabel(primaryErpIntegration)}
              </SmallBadge>
            ) : null
          }
        >
          {primaryErpIntegration ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#1E3DFF]/20 bg-[linear-gradient(135deg,rgba(30,61,255,0.18),rgba(8,18,37,0.95))] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {primaryErpIntegration.provider.name}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#7EC3FF]">
                      {providerCategoryLabel[primaryErpIntegration.provider.category]}
                    </div>
                  </div>
                  <SmallBadge className={integrationStatusClass(primaryErpIntegration)}>
                    {integrationStatusLabel(primaryErpIntegration)}
                  </SmallBadge>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {primaryErpIntegration.provider.description ??
                    'ERP planejado para sincronizar catálogo, estoque e pedidos.'}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Ambiente
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {primaryErpIntegration.integration?.environment ?? 'Não configurado'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Último sync
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {integrationLastSyncLabel(primaryErpIntegration)}
                  </div>
                </div>
              </div>

              {integrationActionHref(primaryErpIntegration) ? (
                <Link
                  href={integrationActionHref(primaryErpIntegration)!}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-3 py-2 text-xs font-semibold text-[#A9C7FF] transition hover:border-[#1E3DFF]/45 hover:text-white"
                >
                  {integrationActionLabel(primaryErpIntegration)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-3 py-2 text-xs font-semibold text-[#A9C7FF] opacity-80"
                >
                  {integrationActionLabel(primaryErpIntegration)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-400/15 bg-amber-400/8 px-3 py-2.5 text-xs text-amber-100">
              Nenhum provider ERP encontrado no registry atual.
            </div>
          )}
        </Panel>

        <Panel
          title="Conectores disponíveis"
          description="Catálogo global da plataforma combinado com o status da loja ativa."
          action={
            <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
              {currentStoreBrand.shortName}
            </SmallBadge>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-white/6">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[minmax(260px,1fr)_120px_130px_140px_160px] gap-3 bg-[#081225] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <span>Conector</span>
                <span>Categoria</span>
                <span>Status</span>
                <span>Último sync</span>
                <span className="text-right">Ação</span>
              </div>
              {integrations.map((item) => (
                <div
                  key={item.provider.key}
                  className="grid grid-cols-[minmax(260px,1fr)_120px_130px_140px_160px] items-center gap-3 border-t border-white/6 px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                      {item.provider.name}
                    </div>
                    <div className="mt-1 truncate text-slate-400">
                      {item.provider.description ?? 'Provider global da plataforma.'}
                    </div>
                  </div>
                  <div className="text-slate-300">
                    {providerCategoryLabel[item.provider.category]}
                  </div>
                  <div>
                    <SmallBadge className={integrationStatusClass(item)}>
                      {integrationStatusLabel(item)}
                    </SmallBadge>
                  </div>
                  <div className="text-slate-300">{integrationLastSyncLabel(item)}</div>
                  <div className="text-right">
                    {integrationActionHref(item) ? (
                      <Link
                        href={integrationActionHref(item)!}
                        className="rounded-md border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A9C7FF] transition hover:border-[#1E3DFF]/45 hover:text-white"
                      >
                        {integrationActionLabel(item)}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-md border border-white/8 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 opacity-75"
                      >
                        {integrationActionLabel(item)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.1fr,1fr]">
        <Panel
          title="Base técnica"
          description="Separação entre registry global e conexão por loja."
        >
          <div className="grid gap-2 md:grid-cols-2">
            {[
              {
                label: 'integration_providers',
                value: `${integrations.length} providers`,
                detail: 'Catálogo global sem credenciais.',
              },
              {
                label: 'store_integrations',
                value: `${connectedIntegrations.length} conectada(s)`,
                detail: 'Configuração filtrada por store_id.',
              },
              {
                label: 'Fonte',
                value: integrationsSourceLabel,
                detail: 'Fallback mock mantém o admin disponível.',
              },
              {
                label: 'Pedidos com ERP ref.',
                value: String(syncedOrders.length),
                detail: 'Referência local, sem envio ao Bling.',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {item.label}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
                <div className="mt-1 text-[11px] leading-5 text-slate-400">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Guardrails"
          description="Limites desta sprint de conectores."
        >
          <div className="space-y-2">
            {[
              'Nenhuma API externa é chamada pelo admin.',
              'credentials_encrypted não é selecionado nem enviado ao client.',
              'Bling aparece como ERP principal, mas ainda sem OAuth real.',
              'Mercos permanece global e não conectado na Brasil Drones.',
              'Mercado Pago e Melhor Envio ficam como planejados.',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-400/12 text-[9px] font-semibold text-emerald-200">
                  OK
                </span>
                <span className="text-xs leading-5 text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="grid gap-4 2xl:grid-cols-[220px,1fr]">
      <Panel title="Credenciais" description="Estrutura lateral enxuta para os blocos internos do admin.">
        <div className="space-y-1.5">
          {[
            { id: 'profile' as SettingsSection, label: 'Perfil do admin', icon: UserRound },
            { id: 'operations' as SettingsSection, label: 'Operação da loja', icon: Store },
            { id: 'notifications' as SettingsSection, label: 'Notificações', icon: Bell },
          ].map((section) => {
            const Icon = section.icon;

            return (
              <button
                  key={section.id}
                  type="button"
                  onClick={() => setSettingsSection(section.id)}
                  className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition',
                  settingsSection === section.id
                    ? 'border-[#1E3DFF]/35 bg-[#101F43] text-white'
                    : 'border-transparent bg-transparent text-slate-400 hover:border-white/6 hover:bg-[#081225] hover:text-slate-200'
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {section.label}
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </Panel>

      {settingsSection === 'profile' ? (
        <div className="space-y-4">
          <Panel
            title="Informações pessoais"
            description="Bloco visual para o perfil do operador principal."
          >
            <div className="grid gap-4 xl:grid-cols-[160px,1fr] xl:items-start">
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1E3DFF,#38BDF8)] text-sm font-semibold text-white">
                  AD
                </div>
                <div className="mt-2 text-sm font-semibold text-white">Admin</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Operação {currentStoreBrand.shortName}
                </div>
              </div>
              <div className="space-y-1">
                <SettingsField label="Nome" value="Administrador da loja" />
                <SettingsField label="E-mail" value="admin@brasildrones.com.br" />
                <SettingsField label="Função" value="Gestão operacional e catálogo" />
                <SettingsField label="Acesso" value={`${adminRoleLabel} autenticado`} />
              </div>
            </div>
          </Panel>

          <Panel
            title="Informações base"
            description="Metadados visuais do painel e origem atual dos dados."
          >
            <div className="space-y-1">
              <SettingsField label="Empresa" value={currentStoreBrand.name} />
              <SettingsField label="Tema" value="Dark SaaS com paleta azul, ciano e verde" />
              <SettingsField label="Status" value="Admin inicial ativo" />
              <SettingsField
                label="Origem"
                value={`Catálogo ${catalogSourceLabel}; pedidos ${ordersSourceLabel}`}
              />
            </div>
          </Panel>
        </div>
      ) : null}

      {settingsSection === 'operations' ? (
        <div className="space-y-4">
          <Panel
            title="Operação da loja"
            description="Parâmetros visuais do fluxo até a integração real."
          >
            <div className="space-y-1">
              <SettingsField label="Catálogo" value={`${products.length} produtos via ${productsSourceLabel}`} />
              <SettingsField label="Categorias" value={`${categories.length} categorias prontas para filtro`} />
              <SettingsField label="Pedidos" value={`${orders.length} pedidos via ${ordersSourceLabel}`} />
              <SettingsField label="ERP" value="Bling ainda não integrado" />
            </div>
          </Panel>

          <Panel
            title="Fluxo interno"
            description="Visão simples dos blocos que já têm sustentação no frontend."
          >
            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                <div className="text-xs font-semibold text-white">Storefront</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Rotas de produto, categoria e carrinho consumindo a camada de catálogo.
                </p>
              </div>
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                <div className="text-xs font-semibold text-white">Mesa operacional</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Pedidos, badges e estados do painel usam o service de pedidos.
                </p>
              </div>
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                <div className="text-xs font-semibold text-white">Integrações</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Serviços externos seguem desacoplados do frontend, como deveria ser.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {settingsSection === 'notifications' ? (
        <div className="space-y-4">
          <Panel
            title="Notificações gerais"
            description="Preferências simuladas para o operador principal."
          >
            <div className="space-y-2">
              {[
                'Pedido aguardando pagamento',
                'Pedido pronto para expedição',
                'Estoque crítico de produto',
                'Falha futura de integração',
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
                >
                  <span className="text-xs font-medium text-slate-100">{item}</span>
                  <div className="flex gap-2">
                    <SmallBadge
                      className={
                        index % 2 === 0
                          ? 'border-[#1E3DFF]/30 bg-[#1E3DFF]/10 text-[#A9C7FF]'
                          : 'border-white/8 bg-white/5 text-slate-300'
                      }
                    >
                      In-app
                    </SmallBadge>
                    <SmallBadge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                      E-mail
                    </SmallBadge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Resumo operacional"
            description="Bloco visual final para fechar a área de configurações."
          >
            <div className="rounded-lg border border-white/6 bg-[linear-gradient(135deg,rgba(30,61,255,0.2),rgba(56,189,248,0.12))] p-4">
              <div className="text-sm font-semibold text-white">
                Painel pronto para crescer
              </div>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
                A estrutura já está em formato de backoffice dark, com shell fixo, cards, tabelas,
                filtros e espaço claro para plugar autenticação, permissões, estoque real e ERP
                sem retrabalho visual.
              </p>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050A14] text-[13px] text-slate-100">
      <aside className="border-b border-white/6 bg-[#050C19]/95 backdrop-blur xl:fixed xl:inset-y-0 xl:left-0 xl:w-60 xl:border-b-0 xl:border-r">
        <div className="flex h-full flex-col gap-4 px-3 py-4">
          <div className="rounded-xl border border-white/6 bg-[#071124] px-3 py-3">
            <img
              src={platformBrand.logoWhite}
              alt={platformBrand.productName}
              className="h-5 w-auto select-none"
              draggable={false}
            />
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Loja ativa
            </div>
            <div className="mt-0.5 truncate text-xs font-semibold text-white">
              {currentStoreBrand.shortName}
            </div>
          </div>

          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              const itemClassName = cn(
                'flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left text-xs transition',
                isActive
                  ? 'border-[#1E3DFF]/35 bg-[linear-gradient(135deg,rgba(30,61,255,0.2),rgba(8,18,37,0.95))] text-white shadow-[0_14px_28px_rgba(30,61,255,0.18)]'
                  : 'border-transparent bg-transparent text-slate-400 hover:border-white/6 hover:bg-[#081225] hover:text-slate-200'
              );
              const content = (
                <>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-lg border',
                        isActive
                          ? 'border-[#1E3DFF]/30 bg-[#101F43] text-[#7EC3FF]'
                          : 'border-white/6 bg-[#081225] text-slate-400'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {item.count}
                  </span>
                </>
              );

              return item.href ? (
                <Link key={item.id} href={item.href} className={itemClassName}>
                  {content}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={itemClassName}
                >
                  {content}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2">
            <div className="rounded-xl border border-white/6 bg-[#081225] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Modo</div>
              <div className="mt-1 text-xs font-semibold text-white">Fonte atual</div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Catálogo {catalogSourceLabel}; pedidos {ordersSourceLabel}.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E3DFF]/30 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(30,61,255,0.2)] transition hover:brightness-110"
            >
              Voltar à loja
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </aside>

      <main className="xl:pl-60">
        <div className="px-3 py-3 sm:px-4 lg:px-5">
          <div className="rounded-xl border border-white/6 bg-[#071124]/92 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.2)] sm:p-4">
            <div className="flex flex-col gap-3 border-b border-white/6 pb-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#7EC3FF]">
                  {view.eyebrow}
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white sm:text-2xl">
                    {view.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                    {view.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/6 bg-[#081225] px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1E3DFF,#38BDF8)] text-xs font-semibold text-white">
                    {adminInitials}
                  </div>
                  <div className="text-left">
                    <div className="max-w-[190px] truncate text-xs font-semibold text-white">
                      {adminEmail}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {adminRoleLabel}
                    </div>
                  </div>
                </div>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-[#081225] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-rose-400/35 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sair
                  </button>
                </form>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-[#081225] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Exportar visão
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="relative block w-full xl:max-w-lg">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar pedido, cliente, produto ou categoria..."
                  className="w-full rounded-xl border border-white/8 bg-[#081225] py-2 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-[#1E3DFF]/35"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                  {products.length} produtos · {productsSourceLabel}
                </SmallBadge>
                <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                  {orders.length} pedidos · {ordersSourceLabel}
                </SmallBadge>
                <SmallBadge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                  Admin {platformBrand.shortName}
                </SmallBadge>
              </div>
            </div>

            <div className="mt-4">
              {activeView === 'dashboard' ? renderDashboard() : null}
              {activeView === 'products' ? renderProducts() : null}
              {activeView === 'orders' ? renderOrders() : null}
              {activeView === 'integrations' ? renderIntegrations() : null}
              {activeView === 'settings' ? renderSettings() : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
