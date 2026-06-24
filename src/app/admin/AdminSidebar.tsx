'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { currentStoreBrand } from '@/lib/branding/current-store-brand';
import { platformBrand } from '@/lib/branding/platform-brand';
import {
  ArrowUpRight,
  Boxes,
  CreditCard,
  Database,
  LayoutGrid,
  Package2,
  Settings2,
  ShoppingCart,
  Store,
  Truck,
  UsersRound,
  Waypoints,
  Wifi,
} from 'lucide-react';

export type AdminSidebarKey =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'customers'
  | 'storefront'
  | 'marketplaces'
  | 'integrations'
  | 'bling'
  | 'payments'
  | 'shipping'
  | 'domains'
  | 'settings';

type AdminViewKey =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'customers'
  | 'integrations'
  | 'settings';

interface AdminSidebarCounts {
  products?: string;
  orders?: string;
  customers?: string;
  integrations?: string;
  primaryErp?: string;
}

interface AdminSidebarItem {
  key: AdminSidebarKey;
  viewKey?: AdminViewKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: string;
  href?: string;
  disabled?: boolean;
}

interface AdminSidebarGroup {
  label: string;
  items: AdminSidebarItem[];
}

interface AdminSidebarProps {
  activeKey?: AdminSidebarKey;
  counts?: AdminSidebarCounts;
  footerLabel?: string;
  footerTitle?: string;
  footerDescription?: string;
  onSelectView?: (view: AdminViewKey) => void;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function buildSidebarGroups(counts?: AdminSidebarCounts): AdminSidebarGroup[] {
  return [
    {
      label: 'Operação',
      items: [
        {
          key: 'dashboard',
          viewKey: 'dashboard',
          label: 'Visão geral',
          icon: LayoutGrid,
          count: '01',
          href: '/admin?view=dashboard',
        },
        {
          key: 'orders',
          viewKey: 'orders',
          label: 'Pedidos',
          icon: ShoppingCart,
          count: counts?.orders ?? '00',
          href: '/admin?view=orders',
        },
        {
          key: 'products',
          viewKey: 'products',
          label: 'Produtos',
          icon: Package2,
          count: counts?.products ?? '06',
          href: '/admin?view=products',
        },
        {
          key: 'customers',
          viewKey: 'customers',
          label: 'Clientes',
          icon: UsersRound,
          count: counts?.customers ?? '01',
          href: '/admin?view=customers',
        },
      ],
    },
    {
      label: 'Canais',
      items: [
        {
          key: 'storefront',
          label: 'Loja online',
          icon: Store,
          count: 'ON',
          href: '/',
        },
        {
          key: 'marketplaces',
          label: 'Marketplaces',
          icon: Boxes,
          count: 'Fut',
          disabled: true,
        },
      ],
    },
    {
      label: 'Conectores',
      items: [
        {
          key: 'integrations',
          viewKey: 'integrations',
          label: 'Integrações',
          icon: Waypoints,
          count: counts?.integrations ?? '04',
          href: '/admin?view=integrations',
        },
        {
          key: 'bling',
          label: 'Bling',
          icon: Database,
          count: counts?.primaryErp ?? 'ERP',
          href: '/admin/integracoes/bling',
        },
      ],
    },
    {
      label: 'Configuração',
      items: [
        {
          key: 'payments',
          label: 'Pagamentos',
          icon: CreditCard,
          count: 'Cfg',
          href: '/admin/configuracoes/pagamentos',
        },
        {
          key: 'shipping',
          label: 'Envios',
          icon: Truck,
          count: 'Cfg',
          href: '/admin/configuracoes/envios',
        },
        {
          key: 'domains',
          label: 'Domínios',
          icon: Wifi,
          count: 'Cfg',
          href: '/admin/configuracoes/dominios',
        },
        {
          key: 'settings',
          viewKey: 'settings',
          label: 'Configurações',
          icon: Settings2,
          count: '02',
          href: '/admin/configuracoes',
        },
      ],
    },
  ];
}

export function AdminSidebar({
  activeKey,
  counts,
  footerLabel = 'Modo',
  footerTitle = 'Fonte atual',
  footerDescription = 'Catálogo Supabase; pedidos Supabase.',
  onSelectView,
}: AdminSidebarProps) {
  const sidebarGroups = buildSidebarGroups(counts);

  return (
    <aside className="border-b border-white/6 bg-[#050C19]/95 backdrop-blur xl:fixed xl:inset-y-0 xl:left-0 xl:w-60 xl:border-b-0 xl:border-r">
      <div className="flex h-full flex-col gap-4 px-3 py-4">
        <div className="rounded-lg border border-white/6 bg-[#071124] px-3 py-3">
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

        <nav className="space-y-4">
          {sidebarGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeKey === item.key;
                const itemClassName = cn(
                  'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition',
                  isActive
                    ? 'border-[#1E3DFF]/35 bg-[linear-gradient(135deg,rgba(30,61,255,0.2),rgba(8,18,37,0.95))] text-white shadow-[0_12px_24px_rgba(30,61,255,0.16)]'
                    : item.disabled
                      ? 'cursor-not-allowed border-transparent bg-transparent text-slate-600'
                      : 'border-transparent bg-transparent text-slate-400 hover:border-white/6 hover:bg-[#081225] hover:text-slate-200'
                );
                const content = (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                          isActive
                            ? 'border-[#1E3DFF]/30 bg-[#101F43] text-[#7EC3FF]'
                            : 'border-white/6 bg-[#081225] text-slate-400'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </span>
                    {item.count ? (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        {item.count}
                      </span>
                    ) : null}
                  </>
                );

                if (item.viewKey && onSelectView) {
                  return (
                    <button
                      key={`${group.label}-${item.label}`}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => onSelectView(item.viewKey!)}
                      className={itemClassName}
                    >
                      {content}
                    </button>
                  );
                }

                if (item.href && !item.disabled) {
                  return (
                    <Link
                      key={`${group.label}-${item.label}`}
                      href={item.href}
                      className={itemClassName}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={`${group.label}-${item.label}`}
                    type="button"
                    disabled
                    className={itemClassName}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {footerLabel}
            </div>
            <div className="mt-1 text-xs font-semibold text-white">{footerTitle}</div>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">
              {footerDescription}
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/30 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(30,61,255,0.2)] transition hover:brightness-110"
          >
            Voltar à loja
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
