'use client';

import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
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
import {
  updateProductStatusAction,
  updateProductStockAction,
} from '@/app/admin/products/actions';
import { logoutAction } from '@/app/login/actions';
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
  Gauge,
  LayoutGrid,
  LifeBuoy,
  Package2,
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
type OrderFilter = 'all' | OrderStatus;
type AdminAccessRole = PlatformRole | StoreRole;
type AdminDataSource = 'supabase' | 'mock';

interface AdminDashboardProps {
  products: ProductSummary[];
  categories: Category[];
  orders: OrderListItem[];
  dataSources: {
    products: AdminDataSource;
    categories: AdminDataSource;
    orders: AdminDataSource;
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
      'Tabela de catálogo, faixa de preço e estoque.',
  },
  orders: {
    eyebrow: 'Mesa operacional',
    title: 'Pedidos e expedição',
    description:
      'Fluxo do pagamento até a separação.',
  },
  integrations: {
    eyebrow: 'Integrações desacopladas',
    title: 'Readiness técnico',
    description:
      'Status visual das integrações futuras.',
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

const productStatusOptions: ProductStatus[] = ['active', 'draft', 'inactive'];

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function sourceLabel(source: AdminDataSource) {
  return source === 'supabase' ? 'Supabase' : 'Mock';
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
  dataSources,
  adminUser,
}: AdminDashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  const searchValue = searchQuery.trim().toLowerCase();

  const activeProducts = products.filter((product) => product.status === 'active');
  const lowStockProducts = products.filter((product) => product.stock <= 3);
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const processingOrders = orders.filter(
    (order) => order.status === 'confirmed' || order.status === 'processing'
  );
  const shippedOrders = orders.filter((order) => order.status === 'shipped');
  const paidOrders = orders.filter((order) => order.paymentStatus === 'paid');
  const syncedOrders = orders.filter((order) => order.externalErpId);

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const averageTicket = orders.length > 0 ? totalRevenue / orders.length : 0;
  const totalProductsValue = products.reduce(
    (sum, product) => sum + product.price,
    0
  );

  const categoryLoad = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: products.filter((product) =>
        product.categories.some((productCategory) => productCategory.slug === category.slug)
      ).length,
    }))
    .sort((left, right) => right.count - left.count);

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
    const textMatches = matchesSearch(
      [
        product.name,
        product.slug,
        product.brand,
        ...product.categories.map((category) => category.name),
      ],
      searchValue
    );

    return statusMatches && textMatches;
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
      count: '03',
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings2,
      count: '02',
    },
  ];

  const view = viewMeta[activeView];
  const adminInitials = initialsFromEmail(adminUser.email);
  const adminEmail = adminUser.email ?? 'admin autenticado';
  const adminRoleLabel = accessRoleLabel[adminUser.role];
  const productsSourceLabel = sourceLabel(dataSources.products);
  const categoriesSourceLabel = sourceLabel(dataSources.categories);
  const ordersSourceLabel = sourceLabel(dataSources.orders);
  const catalogSourceLabel =
    dataSources.products === 'supabase' || dataSources.categories === 'supabase'
      ? 'Supabase'
      : 'Mock';
  const canMutateProducts = dataSources.products === 'supabase';

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

  const renderProducts = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={Store}
          label="Produtos no painel"
          value={String(products.length)}
          helper={`Catálogo carregado via ${productsSourceLabel}.`}
        />
        <MetricCard
          icon={Activity}
          label="Ativos"
          value={String(activeProducts.length)}
          helper="Itens visíveis no storefront atual."
        />
        <MetricCard
          icon={LifeBuoy}
          label="Baixo estoque"
          value={String(lowStockProducts.length)}
          helper="Produtos com estoque menor ou igual a 3 unidades."
        />
        <MetricCard
          icon={CreditCard}
          label="Faixa média"
          value={formatCurrency(totalProductsValue / Math.max(products.length, 1))}
          helper={`Média simples via ${productsSourceLabel}.`}
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.45fr,0.8fr]">
        <Panel
          title="Lista de produtos"
          description="Edição operacional de estoque e status do catálogo."
          action={
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'active', 'draft', 'inactive'] as ProductFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setProductFilter(filter)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition',
                    productFilter === filter
                      ? 'border-[#1E3DFF]/35 bg-[#1E3DFF]/12 text-[#A9C7FF]'
                      : 'border-white/8 bg-[#081225] text-slate-400 hover:text-slate-200'
                  )}
                >
                  {filter === 'all' ? 'Todos' : productStatusLabel[filter]}
                </button>
              ))}
            </div>
          }
        >
          {!canMutateProducts ? (
            <div className="mb-3 rounded-lg border border-amber-400/15 bg-amber-400/8 px-3 py-2 text-xs text-amber-100">
              Fonte mock ativa: edição desabilitada até conectar a chave server-side do Supabase.
            </div>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-white/6">
            <div className="grid grid-cols-[1.45fr,0.9fr,0.72fr,0.9fr,1fr] gap-3 bg-[#081225] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <span>Produto</span>
              <span>Categoria</span>
              <span>Preço</span>
              <span>Estoque</span>
              <span>Status</span>
            </div>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="grid grid-cols-[1.45fr,0.9fr,0.72fr,0.9fr,1fr] gap-3 border-t border-white/6 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-9 w-9 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1E3DFF,#38BDF8)] text-xs font-semibold text-white">
                      {initialsFromName(product.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{product.name}</div>
                    <div className="mt-1 truncate text-slate-400">
                      {product.brand ?? 'Sem marca'}
                    </div>
                  </div>
                </div>
                <div className="text-slate-300">
                  {product.categories.map((category) => category.name).join(', ')}
                </div>
                <div className="font-semibold text-white">
                  {formatCurrency(product.promotionalPrice ?? product.price)}
                </div>
                <form
                  action={updateProductStockAction}
                  className="flex items-center gap-1.5"
                >
                  <input type="hidden" name="productId" value={product.id} />
                  <input
                    type="number"
                    name="stock"
                    min={0}
                    defaultValue={product.stock}
                    disabled={!canMutateProducts}
                    className="h-8 w-16 rounded-md border border-white/8 bg-[#050B18] px-2 text-xs font-semibold text-white outline-none transition focus:border-[#1E3DFF]/45 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!canMutateProducts}
                    className="h-8 rounded-md border border-white/8 bg-white/5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </form>
                <form
                  action={updateProductStatusAction}
                  className="flex items-center gap-1.5"
                >
                  <input type="hidden" name="productId" value={product.id} />
                  <select
                    name="status"
                    defaultValue={product.status}
                    disabled={!canMutateProducts}
                    className="h-8 min-w-24 rounded-md border border-white/8 bg-[#050B18] px-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-[#1E3DFF]/45 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {productStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {productStatusLabel[status]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!canMutateProducts}
                    className={cn(
                      'h-8 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50',
                      productStatusClass[product.status]
                    )}
                  >
                    Aplicar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Categorias"
            description={`Volume de produtos por agrupamento via ${categoriesSourceLabel}.`}
          >
            <div className="space-y-2">
              {categoryLoad.map((category, index) => (
                <div
                  key={category.id}
                  className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: ['#38BDF8', '#1E3DFF', '#00E676', '#8B5CF6'][index % 4],
                        }}
                      />
                      <span className="text-xs font-medium text-slate-100">{category.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {category.count} produto(s)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Reposição visual"
            description="Itens que entram primeiro na fila de conferência."
          >
            <div className="space-y-2">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-lg border border-amber-400/12 bg-amber-400/6 px-3 py-2.5"
                  >
                    <div className="text-xs font-semibold text-white">{product.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      Estoque atual: {product.stock} unidade(s)
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-3 py-2.5 text-xs text-emerald-200">
                  Nenhum item em faixa crítica na base atual.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );

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
          label="Catálogo"
          value={String(products.length)}
          helper={`Storefront e painel via ${catalogSourceLabel}.`}
        />
        <MetricCard
          icon={RefreshCw}
          label="Pedidos com ERP ref."
          value={String(syncedOrders.length)}
          helper="Sem chamada real ao Bling."
        />
        <MetricCard
          icon={Wifi}
          label="Integrações reais"
          value="0"
          helper="Bling e pagamentos seguem desligados."
        />
        <MetricCard
          icon={ShieldCheck}
          label="Layout pronto"
          value="100%"
          helper="Admin já respira como backoffice SaaS dark."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Bling" description="ERP operacional continua desacoplado do frontend.">
          <div className="space-y-3">
            <SmallBadge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
              Não integrado
            </SmallBadge>
            <p className="text-xs leading-5 text-slate-300">
              O layout já prevê sincronização de pedidos e catálogo, mas sem chamar endpoints reais
              nem assumir payloads fora da documentação oficial.
            </p>
            <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5 text-xs text-slate-300">
              {syncedOrders.length} pedidos carregam referência visual de ERP.
            </div>
          </div>
        </Panel>

        <Panel title="Supabase" description={`Catálogo: ${catalogSourceLabel}. Pedidos: ${ordersSourceLabel}.`}>
          <div className="space-y-3">
            <SmallBadge className="border-sky-400/20 bg-sky-400/10 text-sky-200">
              {catalogSourceLabel === 'Supabase' || ordersSourceLabel === 'Supabase'
                ? 'Conectado'
                : 'Fallback ativo'}
            </SmallBadge>
            <p className="text-xs leading-5 text-slate-300">
              O painel lê por services/repositories no servidor. Quando a configuração não está
              disponível, o fallback mock mantém a operação local funcionando.
            </p>
            <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5 text-xs text-slate-300">
              Nenhuma chave sensível é enviada ao client-side.
            </div>
          </div>
        </Panel>

        <Panel title="Storefront" description={`Vitrine pública e painel usam catálogo via ${catalogSourceLabel}.`}>
          <div className="space-y-3">
            <SmallBadge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              Ativo
            </SmallBadge>
            <p className="text-xs leading-5 text-slate-300">
              As rotas públicas consomem a mesma camada de catálogo, sem conhecer se a fonte é
              Supabase ou fallback mock.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white"
            >
              Abrir storefront
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.15fr,1fr]">
        <Panel
          title="Checklist de readiness"
          description="O que já está sustentado visualmente e o que segue isolado."
        >
          <div className="space-y-2">
            {[
              'Rotas públicas reais usando modules/catalog.',
              'Tela de carrinho visual mantendo linguagem operacional.',
              'Dashboard admin dark inspirado em SaaS operacional.',
              `Catálogo via ${catalogSourceLabel}.`,
              'Bling ainda não integrado.',
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-semibold',
                    index < 3
                      ? 'bg-emerald-400/12 text-emerald-200'
                      : 'bg-amber-400/12 text-amber-200'
                  )}
                >
                  {index < 3 ? 'OK' : 'TO'}
                </span>
                <span className="text-xs leading-5 text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Fila para integração futura"
          description="Itens operacionais que já existem visualmente e depois recebem dados reais."
        >
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">{order.orderNumber}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {order.customerName ?? 'Cliente não identificado'} • {order.salesChannel}
                    </div>
                  </div>
                  <SmallBadge className={order.externalErpId ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-slate-400/20 bg-slate-400/10 text-slate-300'}>
                    {order.externalErpId ? 'Referência ERP' : 'Local'}
                  </SmallBadge>
                </div>
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

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left text-xs transition',
                    isActive
                      ? 'border-[#1E3DFF]/35 bg-[linear-gradient(135deg,rgba(30,61,255,0.2),rgba(8,18,37,0.95))] text-white shadow-[0_14px_28px_rgba(30,61,255,0.18)]'
                      : 'border-transparent bg-transparent text-slate-400 hover:border-white/6 hover:bg-[#081225] hover:text-slate-200'
                  )}
                >
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
