'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
import type { CustomerListItem } from '@/modules/customers/customer.types';
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
  updateProductBusinessPriceAction,
  updateProductStatusAction,
  updateProductStockAction,
} from '@/app/admin/products/actions';
import { createAdminCustomerAction } from '@/app/admin/customers/actions';
import { AdminSidebar } from '@/app/admin/AdminSidebar';
import {
  AdminContentGrid,
  AdminKpiGrid,
  AdminModal,
  AdminPageFrame,
  AdminSectionCard,
} from '@/components/admin/AdminLayout';
import type { AdminVariantPriceSummary } from '@/modules/pricing/pricing.types';
import { platformBrand } from '@/lib/branding/platform-brand';
import type { StoreContext } from '@/modules/stores/store.types';
import {
  Boxes,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  CreditCard,
  Database,
  FileWarning,
  Filter,
  Gauge,
  Package2,
  Plus,
  RefreshCw,
  LogOut,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Truck,
  UserRound,
  UsersRound,
  Wifi,
} from 'lucide-react';

type AdminView =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'customers'
  | 'integrations'
  | 'settings';
type SettingsSection = 'profile' | 'operations';
type ProductFilter = 'all' | ProductStatus;
type ProductSourceFilter = 'all' | 'zalen' | 'bling';
type OrderFilter = 'all' | OrderStatus;
type AdminAccessRole = PlatformRole | StoreRole;
type AdminDataSource = 'supabase' | 'mock' | 'unavailable';

interface AdminDashboardProps {
  store: Pick<StoreContext, 'name' | 'shortName'>;
  products: ProductSummary[];
  categories: Category[];
  orders: OrderListItem[];
  customers: CustomerListItem[];
  variantPrices: AdminVariantPriceSummary[];
  integrations: StoreIntegrationListItem[];
  dataSources: {
    products: AdminDataSource;
    categories: AdminDataSource;
    orders: AdminDataSource;
    customers: AdminDataSource;
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
  customers: {
    eyebrow: 'Relacionamento operacional',
    title: 'Clientes',
    description:
      'Base de compradores, contato e histórico para pedidos e ERP.',
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

function formatShortDate(value: string) {
  return shortDateFormatter.format(new Date(value));
}

function formatDateTime(value: string) {
  return longDateFormatter.format(new Date(value));
}

function isSameCalendarDate(value: string, date = new Date()) {
  const current = new Date(value);

  return (
    current.getFullYear() === date.getFullYear() &&
    current.getMonth() === date.getMonth() &&
    current.getDate() === date.getDate()
  );
}

function orderMetadataString(order: OrderListItem, key: string) {
  const value = order.shippingMetadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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
  if (source === 'supabase') {
    return 'Supabase';
  }

  return source === 'mock' ? 'Mock' : 'Indisponível';
}

function isAdminView(value: string | null): value is AdminView {
  return (
    value === 'dashboard' ||
    value === 'products' ||
    value === 'orders' ||
    value === 'customers' ||
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
    <AdminSectionCard
      title={title}
      description={description}
      action={action}
      className={className}
    >
      {children}
    </AdminSectionCard>
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

function OperationalMetricCard({
  icon: Icon,
  label,
  value,
  amount,
  helper,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  amount: string;
  helper: string;
  accent: 'blue' | 'amber' | 'emerald' | 'rose';
}) {
  const accentClass = {
    blue: 'border-[#1E3DFF]/35 bg-[#1E3DFF]/12 text-[#7EC3FF]',
    amber: 'border-amber-400/30 bg-amber-400/12 text-amber-200',
    emerald: 'border-emerald-400/30 bg-emerald-400/12 text-emerald-200',
    rose: 'border-rose-400/30 bg-rose-400/12 text-rose-200',
  }[accent];

  return (
    <div className="min-h-[132px] rounded-lg border border-white/8 bg-[linear-gradient(180deg,rgba(13,28,56,0.92),rgba(7,17,36,0.96))] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3">
        <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', accentClass)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-300">{label}</div>
          <div className="mt-1 text-2xl font-semibold leading-none text-white">
            {value}
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-white/6 pt-3">
        <div className="text-sm font-semibold text-white">{amount}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">{helper}</div>
      </div>
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

function ActionRow({
  icon: Icon,
  title,
  description,
  count,
  tone,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  count: number;
  tone: 'blue' | 'amber' | 'emerald' | 'rose';
  onClick: () => void;
}) {
  const toneClass = {
    blue: 'border-[#1E3DFF]/25 bg-[#1E3DFF]/10 text-[#8DB6FF]',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    emerald: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    rose: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-white/7 bg-[#081529] px-3 py-3 text-left transition hover:border-[#1E3DFF]/30 hover:bg-[#0A1931]"
    >
      <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', toneClass)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-white">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-400">
          {description}
        </span>
      </span>
      <span className={cn('inline-flex min-w-8 justify-center rounded-md border px-2 py-1 text-[11px] font-semibold', toneClass)}>
        {count}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-500" />
    </button>
  );
}

function MiniStatusRow({
  label,
  detail,
  status,
  tone,
}: {
  label: string;
  detail: string;
  status: string;
  tone: 'ok' | 'warn' | 'neutral' | 'danger';
}) {
  const toneClass = {
    ok: 'text-emerald-300',
    warn: 'text-amber-300',
    neutral: 'text-slate-300',
    danger: 'text-rose-300',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/6 px-1 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-100">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</div>
      </div>
      <div className={cn('shrink-0 text-[11px] font-semibold', toneClass)}>
        {status}
      </div>
    </div>
  );
}

function RevenueLineChart({
  series,
}: {
  series: Array<{ label: string; primary: number; secondary: number }>;
}) {
  const values = series.map((point) => point.primary);
  const maxValue = Math.max(1, ...values);
  const width = 420;
  const height = 176;
  const padding = 18;
  const step = (width - padding * 2) / Math.max(series.length - 1, 1);
  const points = series.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - (point.primary / maxValue) * (height - padding * 2);
    return { ...point, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = [
    `${padding},${height - padding}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${width - padding},${height - padding}`,
  ].join(' ');

  return (
    <div className="h-56 rounded-lg border border-white/6 bg-[#071225] p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Faturamento recente"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id="dashboard-revenue-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1E3DFF" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#1E3DFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((linePosition) => (
          <line
            key={linePosition}
            x1={padding}
            x2={width - padding}
            y1={padding + (height - padding * 2) * linePosition}
            y2={padding + (height - padding * 2) * linePosition}
            stroke="rgba(148,163,184,0.14)"
            strokeDasharray="4 5"
          />
        ))}
        <polygon points={area} fill="url(#dashboard-revenue-area)" />
        <polyline
          points={line}
          fill="none"
          stroke="#3B82F6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {points.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="#071225" stroke="#60A5FA" strokeWidth="3" />
            <circle cx={point.x} cy={point.y} r="2" fill="#BFDBFE" />
          </g>
        ))}
      </svg>
      <div className="-mt-3 grid grid-cols-5 gap-2 text-center text-[10px] uppercase text-slate-500">
        {series.map((point, index) => (
          <span key={`${point.label}-${index}`} className="truncate">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function InlineSubmitButton({
  idleLabel = 'Salvar',
  disabled = false,
}: {
  idleLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex h-8 min-w-16 items-center justify-center rounded-md border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A9C7FF] transition hover:border-[#1E3DFF]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Salvando' : idleLabel}
    </button>
  );
}

function ProductStatusForm({
  product,
  canEdit,
}: {
  product: ProductSummary;
  canEdit: boolean;
}) {
  return (
    <form action={updateProductStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={product.id} />
      <select
        name="status"
        defaultValue={product.status}
        disabled={!canEdit}
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
      <InlineSubmitButton disabled={!canEdit} />
    </form>
  );
}

function ProductStockForm({
  product,
  canEdit,
}: {
  product: ProductSummary;
  canEdit: boolean;
}) {
  return (
    <form action={updateProductStockAction} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={product.id} />
      <input
        type="number"
        name="stock"
        min={0}
        defaultValue={product.stock}
        disabled={!canEdit}
        aria-label={`Estoque de ${product.name}`}
        className="h-8 w-20 rounded-md border border-white/8 bg-[#081225] px-2.5 text-[11px] font-semibold text-white outline-none transition [appearance:textfield] placeholder:text-slate-500 focus:border-[#1E3DFF]/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <InlineSubmitButton disabled={!canEdit} />
    </form>
  );
}

function ProductBusinessPriceForm({
  product,
  businessPrice,
  canEdit,
}: {
  product: ProductSummary;
  businessPrice?: AdminVariantPriceSummary;
  canEdit: boolean;
}) {
  if (!product.variantId) {
    return (
      <div className="mt-2 text-[10px] font-medium text-slate-500">
        PJ indisponível
      </div>
    );
  }

  return (
    <form
      action={updateProductBusinessPriceAction}
      className="mt-2 flex items-center gap-2"
    >
      <input type="hidden" name="variantId" value={product.variantId} />
      <label className="sr-only" htmlFor={`business-price-${product.variantId}`}>
        Preço PJ de {product.name}
      </label>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        PJ
      </span>
      <input
        id={`business-price-${product.variantId}`}
        type="number"
        name="price"
        min={0}
        step="0.01"
        defaultValue={businessPrice?.promotionalPrice ?? businessPrice?.price ?? ''}
        disabled={!canEdit}
        placeholder={formatCurrency(product.promotionalPrice ?? product.price)}
        aria-label={`Preço PJ de ${product.name}`}
        className="h-8 w-24 rounded-md border border-white/8 bg-[#081225] px-2.5 text-[11px] font-semibold text-white outline-none transition [appearance:textfield] placeholder:text-slate-600 focus:border-[#1E3DFF]/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <InlineSubmitButton idleLabel="PJ" disabled={!canEdit} />
    </form>
  );
}

function CustomerCreateForm({ canCreate }: { canCreate: boolean }) {
  return (
    <form action={createAdminCustomerAction} className="grid gap-2 md:grid-cols-2">
      <input
        name="name"
        required
        disabled={!canCreate}
        placeholder="Nome do cliente"
        className="h-9 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#1E3DFF]/35"
      />
      <input
        name="email"
        type="email"
        disabled={!canCreate}
        placeholder="E-mail"
        className="h-9 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#1E3DFF]/35"
      />
      <input
        name="phone"
        disabled={!canCreate}
        placeholder="WhatsApp"
        className="h-9 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#1E3DFF]/35"
      />
      <input
        name="document"
        disabled={!canCreate}
        placeholder="CPF/CNPJ"
        className="h-9 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#1E3DFF]/35"
      />
      <input
        name="notes"
        disabled={!canCreate}
        placeholder="Observação operacional"
        className="h-9 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#1E3DFF]/35 md:col-span-2"
      />
      <div className="md:col-span-2">
        <InlineSubmitButton idleLabel="Adicionar" disabled={!canCreate} />
      </div>
    </form>
  );
}

function OrderBlingRetryButton({
  orderId,
  canRetry,
}: {
  orderId: string;
  canRetry: boolean;
}) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'done' | 'skipped' | 'error'
  >('idle');
  const [message, setMessage] = useState<string | undefined>();

  function getRetryMessage(result: unknown, responseOk: boolean) {
    const record =
      result && typeof result === 'object'
        ? (result as Record<string, unknown>)
        : {};
    const errorCode =
      typeof record.errorCode === 'string' ? record.errorCode : undefined;

    if (errorCode === 'bling_order_send_disabled') {
      return 'Envio real desligado na integração Bling.';
    }

    if (errorCode === 'order_already_synced') {
      return 'Pedido já sincronizado no Bling.';
    }

    if (
      errorCode === 'order_missing_customer_data' ||
      errorCode === 'order_missing_items' ||
      errorCode === 'bling_order_response_missing_id'
    ) {
      return 'Payload do pedido incompleto para o contrato Bling.';
    }

    if (errorCode?.startsWith('bling_not_connected')) {
      return 'Bling ainda não conectado para esta loja.';
    }

    if (errorCode?.startsWith('bling_request_failed')) {
      return 'Bling retornou erro seguro no envio.';
    }

    if (responseOk) {
      return 'Pedido processado.';
    }

    return 'Não foi possível reprocessar agora.';
  }

  async function handleRetry() {
    if (!canRetry) {
      return;
    }

    setStatus('loading');
    setMessage(undefined);

    const response = await fetch('/api/integrations/bling/orders/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });
    const result = await response.json().catch(() => undefined);
    const nextStatus =
      response.ok && result?.status === 'skipped'
        ? 'skipped'
        : response.ok
          ? 'done'
          : 'error';

    setStatus(nextStatus);
    setMessage(getRetryMessage(result, response.ok));

    if (nextStatus === 'done') {
      window.setTimeout(() => window.location.reload(), 500);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleRetry}
        disabled={!canRetry || status === 'loading'}
        className="rounded-md border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A9C7FF] transition hover:border-[#1E3DFF]/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'loading'
          ? 'Enviando'
          : status === 'error'
            ? 'Erro'
            : status === 'skipped'
              ? 'Aviso'
              : 'Reprocessar'}
      </button>
      {message ? (
        <div className="max-w-[180px] text-[11px] leading-4 text-slate-400">
          {message}
        </div>
      ) : null}
    </div>
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
    <div
      className={cn(
        'grid gap-4 xl:items-center',
        items.length > 0 ? 'xl:grid-cols-[150px_1fr]' : 'place-items-center'
      )}
    >
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
      {items.length > 0 ? (
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
      ) : null}
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
        {series.map((point, index) => (
          <div key={`${point.label}-${index}`} className="flex h-32 flex-col justify-end gap-2">
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
    <div className="grid gap-2 border-b border-white/6 py-2.5 last:border-b-0 md:grid-cols-[130px_1fr] md:items-center">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <div className="rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs text-slate-200">
        {value}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  store,
  products,
  categories,
  orders,
  customers,
  variantPrices,
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
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productSourceFilter, setProductSourceFilter] =
    useState<ProductSourceFilter>('all');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  useEffect(() => {
    setActiveView(isAdminView(requestedView) ? requestedView : 'dashboard');
  }, [requestedView]);

  function handleSelectAdminView(view: AdminView) {
    setActiveView(view);
    window.history.pushState(null, '', `/admin?view=${view}`);
  }

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
  const pendingPaymentOrders = orders.filter(
    (order) =>
      order.paymentStatus === 'pending' && order.status !== 'cancelled'
  );
  const processingOrders = orders.filter(
    (order) =>
      order.paymentStatus === 'paid' &&
      (order.status === 'confirmed' || order.status === 'processing')
  );
  const shippedOrders = orders.filter((order) => order.status === 'shipped');
  const paidOrders = orders.filter((order) => order.paymentStatus === 'paid');
  const fulfillmentWithoutPaymentOrders = orders.filter(
    (order) =>
      order.paymentStatus !== 'paid' &&
      (order.status === 'processing' ||
        order.status === 'shipped' ||
        order.status === 'delivered')
  );
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
  const businessPricesByVariantId = new Map(
    variantPrices
      .filter((price) => price.customerType === 'pj')
      .map((price) => [price.variantId, price])
  );

  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const averageTicket =
    paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
  const totalProductsValue = products.reduce(
    (sum, product) => sum + product.price,
    0
  );

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

  const revenueSeriesBase = paidOrders
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
        order.customerType,
        order.priceListName,
      ],
      searchValue
    );

    return statusMatches && textMatches;
  });

  const filteredCustomers = customers.filter((customer) =>
    matchesSearch(
      [
        customer.name,
        customer.email,
        customer.phone,
        customer.document,
        customer.customerType,
        customer.legalName,
        customer.lastOrderNumber,
      ],
      searchValue
    )
  );
  const customersWithOrders = customers.filter((customer) => customer.ordersCount > 0);
  const customerRevenue = customers.reduce(
    (accumulator, customer) => accumulator + customer.totalSpent,
    0
  );
  const customersSourceLabel = sourceLabel(dataSources.customers);

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
  const canManageStore = adminUser.role !== 'store_viewer';
  const canEditProducts =
    canManageStore && dataSources.products === 'supabase';
  const canCreateCustomers =
    canManageStore && dataSources.customers === 'supabase';

  const renderDashboard = () => {
    const todayOrders = orders.filter((order) => isSameCalendarDate(order.createdAt));
    const todayPaidOrders = paidOrders.filter((order) =>
      isSameCalendarDate(order.createdAt)
    );
    const todayRevenue = todayPaidOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const pendingPaymentValue = pendingPaymentOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const readyToShipOrders = processingOrders;
    const readyToShipValue = readyToShipOrders.reduce((sum, order) => sum + order.total, 0);
    const criticalStockProducts = lowStockProducts
      .slice()
      .sort((left, right) => left.stock - right.stock)
      .slice(0, 5);
    const missingTrackingOrders = orders.filter(
      (order) =>
        order.paymentStatus === 'paid' &&
        order.status !== 'delivered' &&
        !orderMetadataString(order, 'trackingCode') &&
        !orderMetadataString(order, 'trackingUrl')
    );
    const integrationAlerts = integrations.filter(
      (item) =>
        item.integration?.status === 'error' ||
        item.integration?.status === 'pending_credentials' ||
        item.integration?.status === 'disconnected'
    );
    const dashboardOrders = [
      ...readyToShipOrders,
      ...pendingPaymentOrders,
      ...orders.filter((order) => order.status === 'shipped'),
    ]
      .filter((order, index, list) => list.findIndex((item) => item.id === order.id) === index)
      .slice(0, 5);
    const categoryValueBySlug = new Map(
      categories.map((category) => [category.slug, 0])
    );
    const productCategoriesByProductId = new Map(
      products.map((product) => [product.id, product.categories])
    );

    paidOrders.forEach((order) => {
      order.items.forEach((item) => {
        const itemCategories = productCategoriesByProductId.get(item.productId) ?? [];

        if (itemCategories.length === 0) {
          return;
        }

        const apportionedValue = item.total / itemCategories.length;

        itemCategories.forEach((category) => {
          categoryValueBySlug.set(
            category.slug,
            (categoryValueBySlug.get(category.slug) ?? 0) + apportionedValue
          );
        });
      });
    });

    const categoryRevenue = categoryLoad
      .map((category, index) => ({
        ...category,
        value: categoryValueBySlug.get(category.slug) ?? 0,
        color: ['#4F66FF', '#2F8DFF', '#65A4FF', '#FBBF24', '#34D399'][index] ?? '#94A3B8',
      }))
      .filter((category) => category.value > 0)
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
    const operationSummary = [
      {
        label: 'Faturamento',
        value: formatCurrency(totalRevenue),
        detail: `${paidOrders.length} pedido(s) pago(s)`,
        icon: CircleDollarSign,
        tone: 'ok' as const,
      },
      {
        label: 'Pedidos',
        value: String(orders.length),
        detail: `${pendingPaymentOrders.length} aguardando pagamento`,
        icon: ShoppingCart,
        tone: pendingPaymentOrders.length > 0 ? ('warn' as const) : ('ok' as const),
      },
      {
        label: 'Ticket médio',
        value: formatCurrency(averageTicket),
        detail: `Base ${ordersSourceLabel}`,
        icon: CreditCard,
        tone: 'neutral' as const,
      },
      {
        label: 'Conversão operacional',
        value: `${Math.round((paidOrders.length / Math.max(orders.length, 1)) * 100)}%`,
        detail: 'pagos sobre pedidos',
        icon: Gauge,
        tone: 'ok' as const,
      },
    ];

    return (
      <div className="space-y-4">
        <AdminKpiGrid>
          <OperationalMetricCard
            icon={ShoppingCart}
            label="Pedidos hoje"
            value={String(todayOrders.length)}
            amount={formatCurrency(todayRevenue)}
            helper={`${todayPaidOrders.length} pago(s) hoje · ${orders.length} na base`}
            accent="blue"
          />
          <OperationalMetricCard
            icon={CreditCard}
            label="Aguardando pagamento"
            value={String(pendingPaymentOrders.length)}
            amount={formatCurrency(pendingPaymentValue)}
            helper="dependem de confirmação"
            accent="amber"
          />
          <OperationalMetricCard
            icon={Truck}
            label="Prontos para envio"
            value={String(readyToShipOrders.length)}
            amount={formatCurrency(readyToShipValue)}
            helper="pagos em separação"
            accent="emerald"
          />
          <OperationalMetricCard
            icon={CircleAlert}
            label="Estoque crítico"
            value={String(lowStockProducts.length)}
            amount={`${criticalStockProducts.length} produto(s)`}
            helper="requerem atenção"
            accent="rose"
          />
        </AdminKpiGrid>

        <div className="grid gap-4 2xl:grid-cols-[0.86fr_1.44fr_0.96fr]">
          <Panel
            title="Ações prioritárias"
            action={
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                Agora
              </SmallBadge>
            }
          >
            <div className="space-y-2">
              <ActionRow
                icon={CreditCard}
                title="Aprovar pagamentos"
                description="Pedidos aguardando análise"
                count={pendingPaymentOrders.length}
                tone="rose"
                onClick={() => handleSelectAdminView('orders')}
              />
              <ActionRow
                icon={Boxes}
                title="Separar pedidos"
                description="Pagos prontos para separação"
                count={readyToShipOrders.length}
                tone="amber"
                onClick={() => handleSelectAdminView('orders')}
              />
              <ActionRow
                icon={Truck}
                title="Pedidos sem rastreio"
                description="Postagem ainda sem código"
                count={missingTrackingOrders.length}
                tone="amber"
                onClick={() => handleSelectAdminView('orders')}
              />
              <ActionRow
                icon={CircleAlert}
                title="Expedição sem pagamento"
                description="Pedidos que exigem correção manual"
                count={fulfillmentWithoutPaymentOrders.length}
                tone="rose"
                onClick={() => handleSelectAdminView('orders')}
              />
              <ActionRow
                icon={Package2}
                title="Produtos com estoque baixo"
                description="Itens abaixo do mínimo visual"
                count={lowStockProducts.length}
                tone="blue"
                onClick={() => handleSelectAdminView('products')}
              />
              <ActionRow
                icon={FileWarning}
                title="Falhas de integração"
                description="Conectores pedem revisão"
                count={integrationAlerts.length}
                tone="rose"
                onClick={() => handleSelectAdminView('integrations')}
              />
            </div>
          </Panel>

          <Panel
            title="Fila operacional"
            action={
              <button
                type="button"
                onClick={() => handleSelectAdminView('orders')}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/8 bg-[#081225] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-[#1E3DFF]/30 hover:text-white"
              >
                Ver todos
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            }
          >
            <div className="overflow-x-auto rounded-lg border border-white/6">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1.1fr_0.7fr_0.82fr_0.95fr_0.7fr] gap-3 bg-[#081225] px-3 py-2 text-[10px] uppercase text-slate-500">
                  <span>Pedido / Cliente</span>
                  <span>Valor</span>
                  <span>Pagamento</span>
                  <span>Fulfillment</span>
                  <span className="text-right">Ação</span>
                </div>
                {dashboardOrders.map((order) => {
                  const canShip =
                    order.paymentStatus === 'paid' &&
                    (order.status === 'confirmed' || order.status === 'processing');
                  const isPending = order.paymentStatus === 'pending';

                  return (
                    <div
                      key={order.id}
                      className="grid grid-cols-[1.1fr_0.7fr_0.82fr_0.95fr_0.7fr] items-center gap-3 border-t border-white/6 px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">
                          {order.orderNumber}
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-slate-400">
                          <span className="truncate">
                            {order.customerName ?? 'Cliente não identificado'}
                          </span>
                          <SmallBadge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                            {order.customerType?.toUpperCase() ?? 'PF'}
                          </SmallBadge>
                        </div>
                      </div>
                      <div className="font-semibold text-white">{formatCurrency(order.total)}</div>
                      <div>
                        <SmallBadge className={paymentStatusClass[order.paymentStatus]}>
                          {paymentStatusLabel[order.paymentStatus]}
                        </SmallBadge>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {order.salesChannel ?? 'Canal local'}
                        </div>
                      </div>
                      <div>
                        <SmallBadge className={orderStatusClass[order.status]}>
                          {orderStatusLabel[order.status]}
                        </SmallBadge>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {formatDateTime(order.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectAdminView('orders')}
                          className={cn(
                            'rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition',
                            canShip
                              ? 'border-[#1E3DFF]/35 bg-[#1E3DFF]/15 text-[#A9C7FF] hover:text-white'
                              : isPending
                                ? 'border-amber-400/25 bg-amber-400/10 text-amber-200 hover:text-white'
                                : 'border-white/8 bg-white/5 text-slate-300 hover:text-white'
                          )}
                        >
                          {canShip ? 'Separar' : isPending ? 'Ver' : 'Abrir'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {dashboardOrders.length === 0 ? (
                  <div className="border-t border-white/6 px-3 py-8 text-center text-xs text-slate-400">
                    Nenhum pedido na fila operacional atual.
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel
              title="Status das integrações"
              action={
                <button
                  type="button"
                  onClick={() => handleSelectAdminView('integrations')}
                  className="text-[11px] font-semibold text-[#7EA8FF] transition hover:text-white"
                >
                  Ver todas
                </button>
              }
            >
              <div className="space-y-1">
                {integrations.slice(0, 5).map((item) => {
                  const status = integrationStatusLabel(item);
                  const tone =
                    item.integration?.status === 'connected' || item.integration?.status === 'syncing'
                      ? 'ok'
                      : item.integration?.status === 'error'
                        ? 'danger'
                        : item.provider.status === 'planned'
                          ? 'warn'
                          : 'neutral';

                  return (
                    <MiniStatusRow
                      key={item.provider.key}
                      label={item.provider.name}
                      detail={providerCategoryLabel[item.provider.category]}
                      status={status}
                      tone={tone}
                    />
                  );
                })}
              </div>
            </Panel>

            <Panel
              title="Produtos com atenção"
              action={
                <button
                  type="button"
                  onClick={() => handleSelectAdminView('products')}
                  className="text-[11px] font-semibold text-[#7EA8FF] transition hover:text-white"
                >
                  Ver todos
                </button>
              }
            >
              <div className="space-y-2">
                {criticalStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 border-b border-white/6 pb-2 last:border-b-0 last:pb-0"
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-9 w-9 rounded-md border border-white/8 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/8 bg-[#101F43] text-[10px] font-semibold text-[#A9C7FF]">
                        {initialsFromName(product.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">
                        {product.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Estoque: {product.stock}
                      </div>
                    </div>
                    <SmallBadge
                      className={
                        product.stock <= 0
                          ? 'border-rose-400/25 bg-rose-400/10 text-rose-200'
                          : 'border-amber-400/25 bg-amber-400/10 text-amber-200'
                      }
                    >
                      {product.stock <= 0 ? 'Esgotado' : 'Baixo'}
                    </SmallBadge>
                  </div>
                ))}
                {criticalStockProducts.length === 0 ? (
                  <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-3 py-3 text-xs text-emerald-100">
                    Nenhum produto em estoque crítico.
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid gap-4 2xl:grid-cols-[1.08fr_0.96fr_0.86fr]">
          <Panel
            title="Faturamento"
            description="Últimos movimentos registrados na base de pedidos."
            action={
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                {ordersSourceLabel}
              </SmallBadge>
            }
          >
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold text-white">
                  {formatCurrency(totalRevenue)}
                </div>
                <div className="mt-1 text-xs text-emerald-300">
                  {paidOrders.length} pedido(s) com pagamento confirmado
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                Ticket medio
                <div className="mt-1 text-sm font-semibold text-white">
                  {formatCurrency(averageTicket)}
                </div>
              </div>
            </div>
            <RevenueLineChart series={revenueSeries} />
          </Panel>

          <Panel
            title="Top categorias"
            action={
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                {categoriesSourceLabel}
              </SmallBadge>
            }
          >
            <div className="grid gap-4 md:grid-cols-[150px_1fr] md:items-center">
              <GaugeCard
                value={String(categories.length)}
                centerLabel="Categorias"
                segments={categoryRevenue.map((item) => ({
                  color: item.color,
                  portion: Math.max(item.value / Math.max(totalRevenue, 1), 0.06),
                }))}
                items={[]}
              />
              <div className="space-y-2">
                {categoryRevenue.length > 0 ? (
                  categoryRevenue.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate text-slate-200">{item.name}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-semibold text-white">
                          {formatCurrency(item.value)}
                        </span>
                        <span className="ml-2 text-[11px] text-slate-500">
                          {item.count} produtos
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-3 text-xs text-slate-400">
                    Sem receita recebida com categorias vinculadas.
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-white/6 pt-3 text-sm">
                  <span className="text-slate-400">Total</span>
                  <span className="font-semibold text-white">{formatCurrency(totalRevenue)}</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Resumo da operação"
            action={
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                Hoje
              </SmallBadge>
            }
          >
            <div className="space-y-2">
              {operationSummary.map((item) => {
                const Icon = item.icon;
                const toneClass = {
                  ok: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
                  warn: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
                  neutral: 'border-[#1E3DFF]/25 bg-[#1E3DFF]/10 text-[#9CC0FF]',
                }[item.tone];

                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
                  >
                    <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', toneClass)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-slate-400">{item.label}</div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">
                        {item.detail}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-white">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    );
  };

  const renderProducts = () => {
    const statusTabs: Array<{ filter: ProductFilter; label: string; count: number }> = [
      { filter: 'all', label: 'Todos', count: products.length },
      { filter: 'active', label: 'Ativo', count: activeProducts.length },
      { filter: 'draft', label: 'Rascunho', count: draftProducts.length },
      { filter: 'inactive', label: 'Inativo', count: inactiveProducts.length },
    ];
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
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
              {products.length} produtos
            </SmallBadge>
            <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
              {activeProducts.length} ativos
            </SmallBadge>
            <SmallBadge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
              {lowStockProducts.length} estoque baixo
            </SmallBadge>
            <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
              {catalogSourceLabel}
            </SmallBadge>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs font-semibold text-slate-300 opacity-80"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Organizar
            </button>
            <button
              type="button"
              disabled
              className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs font-semibold text-slate-300 opacity-80"
            >
              Exportar e importar
            </button>
            <button
              type="button"
              disabled
              className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 text-xs font-semibold text-white opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar produto
            </button>
          </div>
        </div>

        <AdminContentGrid
          sidebarWidth="300px"
          sidebar={
            <>
              <Panel title="Filtros ativos" description="Recorte atual da lista.">
                <div className="space-y-2">
                  {[
                    ['Categoria', activeCategory?.name ?? 'Todas'],
                    ['Fonte', sourceFilterLabel],
                    [
                      'Status',
                      productFilter === 'all'
                        ? 'Todos'
                        : productStatusLabel[productFilter],
                    ],
                    ['Resultado', `${filteredProducts.length} produto(s)`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs"
                    >
                      <span className="text-slate-400">{label}</span>
                      <span className="truncate font-semibold text-white">{value}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setProductCategoryFilter('all');
                      setProductSourceFilter('all');
                      setProductFilter('all');
                    }}
                    disabled={!hasActiveProductFilters}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs font-semibold text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Limpar filtros
                  </button>
                </div>
              </Panel>

              <Panel title="Estoque crítico" description="Itens que pedem revisão.">
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white">
                          {product.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {productSourceLabel(product)}
                        </div>
                      </div>
                      <SmallBadge
                        className={
                          product.stock <= 0
                            ? 'border-rose-400/25 bg-rose-400/10 text-rose-200'
                            : 'border-amber-400/25 bg-amber-400/10 text-amber-200'
                        }
                      >
                        {product.stock}
                      </SmallBadge>
                    </div>
                  ))}
                  {lowStockProducts.length === 0 ? (
                    <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-3 py-3 text-xs text-emerald-100">
                      Sem estoque crítico.
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel title="Categorias" description="Carga operacional.">
                <div className="space-y-2">
                  {categoryLoad.slice(0, 6).map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setProductCategoryFilter(category.slug)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-left text-xs transition hover:border-[#1E3DFF]/30"
                    >
                      <span className="truncate font-medium text-slate-200">
                        {category.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {category.count}
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          }
        >
        <Panel
          title="Lista de produtos"
          description="Busca, edição rápida e revisão do catálogo em uma tabela única."
          action={
            <div className="hidden flex-wrap gap-1.5 xl:flex">
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                {activeCategory?.name ?? 'Todas as categorias'}
              </SmallBadge>
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                {sourceFilterLabel}
              </SmallBadge>
            </div>
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
                Mostrando {filteredProducts.length} de {products.length}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/6">
              <div className="min-w-[1080px]">
                <div className="grid grid-cols-[minmax(330px,1.7fr)_150px_185px_185px_200px_90px] gap-3 bg-[#081225] px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <span>Produto</span>
                  <span>Estoque</span>
                  <span>Preço</span>
                  <span>Preço PJ</span>
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
                  const hasPotentialDuplicate = potentialDuplicateProductIds.has(product.id);
                  const businessPrice = product.variantId
                    ? businessPricesByVariantId.get(product.variantId)
                    : undefined;

                  return (
                    <div
                      key={product.id}
                      className="grid grid-cols-[minmax(330px,1.7fr)_150px_185px_185px_200px_90px] items-center gap-3 border-t border-white/6 px-4 py-3 text-xs transition hover:bg-white/[0.015]"
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
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                            {primaryCategory ? (
                              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                                {primaryCategory.name}
                              </SmallBadge>
                            ) : (
                              <span>Sem categoria</span>
                            )}
                            {extraCategoriesCount > 0 ? (
                              <span>+{extraCategoriesCount}</span>
                            ) : null}
                            <span>SKU: {productSku(product)}</span>
                            {product.brand ? <span>Marca: {product.brand}</span> : null}
                            <SmallBadge className={productSourceClass(product)}>
                              {productSourceLabel(product)}
                            </SmallBadge>
                            {hasPotentialDuplicate ? (
                              <SmallBadge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
                                Duplicado
                              </SmallBadge>
                            ) : null}
                            {product.externalProvider === 'bling' && blingLastSyncAt ? (
                              <span>Sync: {formatDateTime(blingLastSyncAt)}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <ProductStockForm
                        product={product}
                        canEdit={canEditProducts}
                      />

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

                      <ProductBusinessPriceForm
                        product={product}
                        businessPrice={businessPrice}
                        canEdit={canEditProducts}
                      />

                      <ProductStatusForm
                        product={product}
                        canEdit={canEditProducts}
                      />

                      <div className="text-right text-[11px] text-slate-500">
                        Edição pela tabela
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
              <span>
                Mostrando {filteredProducts.length} de {products.length} produtos
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
        </AdminContentGrid>
      </div>
    );
  };

  const renderOrders = () => (
    <div className="space-y-4">
      <AdminKpiGrid>
        <MetricCard
          icon={ShoppingCart}
          label="Pedidos no painel"
          value={String(orders.length)}
          helper={`Mesa operacional via ${ordersSourceLabel}.`}
        />
        <MetricCard
          icon={CreditCard}
          label="Aguardando pagamento"
          value={String(pendingPaymentOrders.length)}
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
      </AdminKpiGrid>

      <div className="grid gap-4 2xl:grid-cols-[1.38fr_0.92fr]">
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
            <div className="grid grid-cols-[1fr_1fr_0.55fr_0.75fr_0.75fr_0.8fr] gap-3 bg-[#081225] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Itens</span>
              <span>Status</span>
              <span>Bling</span>
              <span className="text-right">Total</span>
            </div>
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1fr_1fr_0.55fr_0.75fr_0.75fr_0.8fr] gap-3 border-t border-white/6 px-3 py-2.5 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{order.orderNumber}</div>
                  <div className="mt-1 text-slate-400">{formatDateTime(order.createdAt)}</div>
                </div>
                <div>
                  <div className="font-medium text-slate-100">
                    {order.customerName ?? 'Cliente não identificado'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400">
                      {order.salesChannel ?? 'Canal local'}
                    </span>
                    <SmallBadge
                      className={cn(
                        order.customerType === 'pj'
                          ? 'border-sky-400/20 bg-sky-400/10 text-sky-200'
                          : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      )}
                    >
                      {order.customerType?.toUpperCase() ?? 'PF'}
                    </SmallBadge>
                    {order.priceListName ? (
                      <span className="text-[11px] text-slate-500">
                        {order.priceListName}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                    {order.customer?.document ? (
                      <div>Doc.: {order.customer.document}</div>
                    ) : null}
                    {order.customerLegalName ? (
                      <div className="truncate">{order.customerLegalName}</div>
                    ) : null}
                  </div>
                </div>
                <div className="text-slate-200">
                  {order.items.length} item(ns)
                  {order.shippingServiceName ? (
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                      <div className="truncate">
                        {order.shippingCarrierName
                          ? `${order.shippingCarrierName} · `
                          : ''}
                        {order.shippingServiceName}
                      </div>
                      <div>{formatCurrency(order.shippingTotal)}</div>
                      {orderMetadataString(order, 'deliveryTimeLabel') ? (
                        <div>{orderMetadataString(order, 'deliveryTimeLabel')}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
                <div className="space-y-1">
                  <SmallBadge
                    className={
                      order.externalErpSyncStatus === 'synced'
                        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                        : order.externalErpSyncStatus === 'error'
                          ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
                          : 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                    }
                  >
                    {order.externalErpSyncStatus === 'synced'
                      ? 'Enviado'
                      : order.externalErpSyncStatus === 'error'
                        ? 'Erro'
                        : 'Pendente'}
                  </SmallBadge>
                  {order.externalErpId ? (
                    <div className="truncate text-[11px] text-slate-400">
                      ID {order.externalErpId}
                    </div>
                  ) : null}
                  {order.externalErpLastError ? (
                    <div className="truncate text-[11px] text-rose-200">
                      {order.externalErpLastError}
                    </div>
                  ) : null}
                  {order.externalErpSyncStatus !== 'synced' ? (
                    <OrderBlingRetryButton
                      orderId={order.id}
                      canRetry={
                        canManageStore && dataSources.orders === 'supabase'
                      }
                    />
                  ) : null}
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
                      {pendingPaymentOrders.length} pedido(s) aguardando aprovação.
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

  const renderCustomers = () => (
    <div className="space-y-4">
      <AdminKpiGrid>
        <MetricCard
          icon={UsersRound}
          label="Clientes na base"
          value={String(customers.length)}
          helper={`Lista operacional via ${customersSourceLabel}.`}
        />
        <MetricCard
          icon={ShoppingCart}
          label="Com compras"
          value={String(customersWithOrders.length)}
          helper="Clientes com ao menos um pagamento confirmado."
        />
        <MetricCard
          icon={CreditCard}
          label="Total consumido"
          value={formatCurrency(customerRevenue)}
          helper="Soma de pagamentos confirmados por cliente identificado."
        />
      </AdminKpiGrid>

      <AdminContentGrid
        sidebarWidth="300px"
        sidebar={
          <>
            <Panel title="Clientes" description="Navegação e ações rápidas.">
              <div className="flex items-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[#101F43] px-3 py-2 text-xs text-white">
                <UsersRound className="h-3.5 w-3.5" />
                Lista de clientes
              </div>
              <button
                type="button"
                onClick={() => setCustomerCreateOpen(true)}
                disabled={!canCreateCustomers}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar cliente
              </button>
            </Panel>

            <Panel title="Segmentos" description="Resumo da base atual.">
              <div className="space-y-2">
                {[
                  ['Com compras', customersWithOrders.length],
                  ['PF', customers.filter((customer) => customer.customerType === 'pf').length],
                  ['PJ', customers.filter((customer) => customer.customerType === 'pj').length],
                  ['Sem pedido', customers.length - customersWithOrders.length],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs"
                  >
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        }
      >
        <div className="space-y-4">
            <Panel
              title="Lista de clientes"
              description="Busca por nome, e-mail, telefone, CPF/CNPJ ou último pedido."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                    Mostrando {filteredCustomers.length} de {customers.length}
                  </SmallBadge>
                  <button
                    type="button"
                    onClick={() => setCustomerCreateOpen(true)}
                    disabled={!canCreateCustomers}
                    className="inline-flex h-8 items-center gap-2 rounded-md border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-2.5 text-[11px] font-semibold text-[#A9C7FF] transition hover:border-[#1E3DFF]/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo
                  </button>
                </div>
              }
            >
              <div className="overflow-x-auto rounded-lg border border-white/6">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[minmax(240px,1fr)_80px_150px_140px_180px] gap-3 bg-[#081225] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <span>Nome</span>
                    <span>Tipo</span>
                    <span>Última compra</span>
                    <span>Total consumido</span>
                    <span className="text-right">Contato</span>
                  </div>
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="grid grid-cols-[minmax(240px,1fr)_80px_150px_140px_180px] items-center gap-3 border-t border-white/6 px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">
                          {customer.name}
                        </div>
                        <div className="mt-1 truncate text-slate-400">
                          {[customer.email, customer.document].filter(Boolean).join(' · ') ||
                            'Sem documento/e-mail'}
                        </div>
                      </div>
                      <div>
                        <SmallBadge
                          className={cn(
                            customer.customerType === 'pj'
                              ? 'border-sky-400/20 bg-sky-400/10 text-sky-200'
                              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                          )}
                        >
                          {customer.customerType.toUpperCase()}
                        </SmallBadge>
                      </div>
                      <div className="text-slate-300">
                        {customer.lastPurchaseAt
                          ? `${customer.lastOrderNumber ?? 'Pedido'} · ${formatDateTime(customer.lastPurchaseAt)}`
                          : 'Sem compras'}
                      </div>
                      <div className="font-semibold text-white">
                        {formatCurrency(customer.totalSpent)}
                      </div>
                      <div className="flex justify-end gap-2">
                        {customer.email ? (
                          <a
                            href={`mailto:${customer.email}`}
                            className="rounded-lg border border-white/8 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:text-white"
                          >
                            E-mail
                          </a>
                        ) : null}
                        {customer.phone ? (
                          <a
                            href={`https://wa.me/55${customer.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 transition hover:text-white"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {filteredCustomers.length === 0 ? (
                    <div className="border-t border-white/6 px-3 py-8 text-center text-xs text-slate-400">
                      Nenhum cliente encontrado na base atual.
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
        </div>
      </AdminContentGrid>

      <AdminModal
        open={customerCreateOpen}
        title="Adicionar cliente"
        description="Cadastro manual simples para operação e pedidos assistidos."
        onClose={() => setCustomerCreateOpen(false)}
      >
        <CustomerCreateForm canCreate={canCreateCustomers} />
      </AdminModal>
    </div>
  );

  const renderIntegrations = () => {
    const integrationStats = [
      {
        label: 'Registry',
        value: String(integrations.length),
        detail: integrationsSourceLabel,
        icon: Database,
      },
      {
        label: 'Conectados',
        value: String(connectedIntegrations.length),
        detail: 'por loja',
        icon: Wifi,
      },
      {
        label: 'Planejados',
        value: String(plannedIntegrations.length),
        detail: 'sem chamada externa',
        icon: RefreshCw,
      },
      {
        label: 'Alertas',
        value: String(erroredIntegrations.length),
        detail: 'store_integrations',
        icon: ShieldCheck,
      },
    ];
    const guardrails = [
      'Sem token no frontend',
      'Sem chamada externa pelo client',
      'Credenciais por store_id',
      'Webhook só server-side',
    ];

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {integrationStats.map((item) => (
              <SmallBadge
                key={item.label}
                className="border-white/8 bg-[#081225] text-slate-300"
              >
                {item.label}: {item.value}
              </SmallBadge>
            ))}
          </div>
          <button
            type="button"
            disabled
            className="inline-flex h-9 w-fit cursor-not-allowed items-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 text-xs font-semibold text-white opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo conector
          </button>
        </div>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <Panel
            title="Conectores"
            description="Catálogo da plataforma combinado com a conexão da loja ativa."
            action={
              <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                {store.shortName}
              </SmallBadge>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {integrationStats.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-2.5 py-2 text-xs"
                    >
                      <Icon className="h-3.5 w-3.5 text-[#7EC3FF]" />
                      <span className="font-semibold text-white">{item.value}</span>
                      <span className="text-slate-400">{item.label}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500">{item.detail}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {integrations.map((item) => {
                  const actionHref = integrationActionHref(item);
                  const isPrimaryErp = item.provider.key === primaryErpIntegration?.provider.key;
                  const environment =
                    item.integration?.environment ??
                    (item.provider.status === 'planned' ? 'Planejado' : 'Não configurado');

                  return (
                    <article
                      key={item.provider.key}
                      className={cn(
                        'rounded-lg border border-white/6 bg-[#081225] p-3 transition hover:border-[#1E3DFF]/25 hover:bg-[#0B1831]',
                        isPrimaryErp ? 'border-[#1E3DFF]/25 bg-[#1E3DFF]/[0.06]' : ''
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#101F43] text-xs font-semibold text-[#A9C7FF]">
                            {item.provider.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-white">
                                {item.provider.name}
                              </h3>
                              {isPrimaryErp ? (
                                <SmallBadge className="border-[#1E3DFF]/30 bg-[#1E3DFF]/10 text-[#A9C7FF]">
                                  ERP principal
                                </SmallBadge>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                              {item.provider.description ?? 'Provider global da plataforma.'}
                            </p>
                          </div>
                        </div>
                        <SmallBadge className={integrationStatusClass(item)}>
                          {integrationStatusLabel(item)}
                        </SmallBadge>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/6 bg-[#0A1730] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Categoria
                          </div>
                          <div className="mt-1 text-xs font-semibold text-white">
                            {providerCategoryLabel[item.provider.category]}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/6 bg-[#0A1730] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Ambiente
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-white">
                            {environment}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/6 bg-[#0A1730] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Último sync
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-white">
                            {integrationLastSyncLabel(item)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        {actionHref ? (
                          <Link
                            href={actionHref}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A9C7FF] transition hover:border-[#1E3DFF]/45 hover:text-white"
                          >
                            {integrationActionLabel(item)}
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-md border border-white/8 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                          >
                            {integrationActionLabel(item)}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>
                  Mostrando {integrations.length} conectores · {connectedIntegrations.length}{' '}
                  conectado(s)
                </span>
                <span>{guardrails.join(' · ')}</span>
              </div>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel
              title="ERP principal"
              description={`Operação da loja ${store.shortName}.`}
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
                  <div className="rounded-lg border border-[#1E3DFF]/20 bg-[linear-gradient(135deg,rgba(30,61,255,0.14),rgba(8,18,37,0.96))] p-3">
                    <div className="text-sm font-semibold text-white">
                      {primaryErpIntegration.provider.name}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      {primaryErpIntegration.provider.description ??
                        'ERP planejado para sincronizar catálogo, estoque e pedidos.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
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

                  <Link
                    href={integrationActionHref(primaryErpIntegration) ?? '/admin'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/25 bg-[#1E3DFF]/10 px-3 py-2 text-xs font-semibold text-[#A9C7FF] transition hover:border-[#1E3DFF]/45 hover:text-white"
                  >
                    {integrationActionLabel(primaryErpIntegration)}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-400/15 bg-amber-400/8 px-3 py-2.5 text-xs text-amber-100">
                  Nenhum provider ERP encontrado no registry atual.
                </div>
              )}
            </Panel>

            <Panel title="Saúde" description="Resumo rápido dos conectores.">
              <div className="space-y-2">
                {[
                  {
                    label: 'Conectados',
                    value: `${connectedIntegrations.length} conector(es)`,
                    className: 'text-emerald-200',
                  },
                  {
                    label: 'Planejados',
                    value: `${plannedIntegrations.length} conector(es)`,
                    className: 'text-amber-200',
                  },
                  {
                    label: 'Pedidos com ERP',
                    value: `${syncedOrders.length} pedido(s)`,
                    className: 'text-[#A9C7FF]',
                  },
                  {
                    label: 'Alertas',
                    value: `${erroredIntegrations.length} alerta(s)`,
                    className: 'text-rose-200',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5 text-xs"
                  >
                    <span className="text-slate-400">{item.label}</span>
                    <span className={cn('font-semibold', item.className)}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Guardrails" description="Limites ativos nesta etapa.">
              <div className="space-y-2">
                {guardrails.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs text-slate-300"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-400/12 text-[9px] font-semibold text-emerald-200">
                      OK
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="grid gap-4 2xl:grid-cols-[220px_1fr]">
      <Panel title="Credenciais" description="Estrutura lateral enxuta para os blocos internos do admin.">
        <div className="space-y-1.5">
          {[
            { id: 'profile' as SettingsSection, label: 'Perfil do admin', icon: UserRound },
            { id: 'operations' as SettingsSection, label: 'Operação da loja', icon: Store },
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
            description="Dados da conta autenticada nesta sessão."
          >
            <div className="grid gap-4 xl:grid-cols-[160px_1fr] xl:items-start">
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1E3DFF,#38BDF8)] text-sm font-semibold text-white">
                  {adminInitials}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">Conta autenticada</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Operação {store.shortName}
                </div>
              </div>
              <div className="space-y-1">
                <SettingsField label="E-mail" value={adminEmail} />
                <SettingsField label="Função" value={adminRoleLabel} />
                <SettingsField label="Escopo" value={store.name} />
                <SettingsField label="Acesso" value="Sessão autenticada" />
              </div>
            </div>
          </Panel>

          <Panel
            title="Informações base"
            description="Contexto atual da loja e origem dos dados exibidos."
          >
            <div className="space-y-1">
              <SettingsField label="Empresa" value={store.name} />
              <SettingsField label="Interface" value="Admin operacional" />
              <SettingsField label="Status" value="Sessão ativa" />
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
            description="Leitura dos dados e integrações configurados para a loja ativa."
          >
            <div className="space-y-1">
              <SettingsField label="Catálogo" value={`${products.length} produtos via ${productsSourceLabel}`} />
              <SettingsField label="Categorias" value={`${categories.length} categorias prontas para filtro`} />
              <SettingsField label="Pedidos" value={`${orders.length} pedidos via ${ordersSourceLabel}`} />
              <SettingsField
                label="ERP"
                value={
                  primaryErpIntegration
                    ? `${primaryErpIntegration.provider.name}: ${integrationStatusLabel(primaryErpIntegration)}`
                    : 'Nenhum ERP cadastrado'
                }
              />
            </div>
          </Panel>

          <Panel
            title="Fluxo interno"
            description="Capacidades disponíveis no escopo atual."
          >
            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                <div className="text-xs font-semibold text-white">Storefront</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Rotas de produto, categoria e carrinho usam a camada de catálogo.
                </p>
              </div>
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                <div className="text-xs font-semibold text-white">Mesa operacional</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Pedidos e estados do painel usam os dados persistidos de pedidos.
                </p>
              </div>
              <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                <div className="text-xs font-semibold text-white">Integrações</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Serviços externos são acionados apenas no servidor.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

    </div>
  );

  return (
    <div className="min-h-screen bg-[#050A14] text-[13px] text-slate-100">
      <AdminSidebar
        activeKey={activeView}
        storeShortName={store.shortName}
        counts={{
          orders: String(orders.length).padStart(2, '0'),
          products: String(products.length).padStart(2, '0'),
          customers: String(customers.length).padStart(2, '0'),
          integrations: String(integrations.length).padStart(2, '0'),
          primaryErp: primaryErpIntegration?.integration?.status === 'connected' ? 'ON' : 'ERP',
        }}
        footerDescription={`Catálogo ${catalogSourceLabel}; pedidos ${ordersSourceLabel}.`}
        onSelectView={handleSelectAdminView}
      />

      <main className="xl:pl-60">
        <AdminPageFrame>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
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
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/8 bg-[#081225] px-3 py-2 text-xs font-medium text-slate-500"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Exportação indisponível
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
                <SmallBadge className="border-white/8 bg-[#081225] text-slate-300">
                  {customers.length} clientes · {customersSourceLabel}
                </SmallBadge>
                <SmallBadge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                  Admin {platformBrand.shortName}
                </SmallBadge>
              </div>
            </div>

            <div>
              {activeView === 'dashboard' ? renderDashboard() : null}
              {activeView === 'products' ? renderProducts() : null}
              {activeView === 'orders' ? renderOrders() : null}
              {activeView === 'customers' ? renderCustomers() : null}
              {activeView === 'integrations' ? renderIntegrations() : null}
              {activeView === 'settings' ? renderSettings() : null}
            </div>
          </div>
        </AdminPageFrame>
      </main>
    </div>
  );
}
