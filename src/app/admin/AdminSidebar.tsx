'use client';

import Link from 'next/link';
import { useEffect, useState, type ComponentType } from 'react';
import { platformBrand } from '@/lib/branding/platform-brand';
import {
  ArrowUpRight,
  Boxes,
  CreditCard,
  Database,
  LayoutGrid,
  Menu,
  MessageCircle,
  Megaphone,
  Package2,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Settings2,
  ShoppingCart,
  Store,
  Truck,
  UsersRound,
  Waypoints,
  Wifi,
  X,
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
  | 'whatsapp'
  | 'marketing'
  | 'payments'
  | 'pricing'
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
  storeShortName: string;
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
          href: '/admin',
        },
        {
          key: 'orders',
          viewKey: 'orders',
          label: 'Pedidos',
          icon: ShoppingCart,
          count: counts?.orders ?? '00',
          href: '/admin/pedidos',
        },
        {
          key: 'products',
          viewKey: 'products',
          label: 'Produtos',
          icon: Package2,
          count: counts?.products ?? '--',
          href: '/admin/produtos',
        },
        {
          key: 'customers',
          viewKey: 'customers',
          label: 'Clientes',
          icon: UsersRound,
          count: counts?.customers ?? '--',
          href: '/admin/clientes',
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
          href: '/admin/configuracoes/loja-online',
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
          href: '/admin/integracoes',
        },
        {
          key: 'bling',
          label: 'Bling',
          icon: Database,
          count: counts?.primaryErp ?? 'ERP',
          href: '/admin/integracoes/bling',
        },
        {
          key: 'whatsapp',
          label: 'WhatsApp',
          icon: MessageCircle,
          count: 'Msg',
          href: '/admin/integracoes/whatsapp',
        },
        {
          key: 'marketing',
          label: 'Marketing',
          icon: Megaphone,
          count: 'SEO',
          href: '/admin/integracoes/marketing',
        },
      ],
    },
    {
      label: 'Configuração',
      items: [
        {
          key: 'pricing',
          label: 'Preços',
          icon: Percent,
          count: 'PJ',
          href: '/admin/configuracoes/precos',
        },
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
  storeShortName,
  counts,
  footerLabel = 'Modo',
  footerTitle = 'Fonte atual',
  footerDescription = 'Operação da loja ativa.',
  onSelectView,
}: AdminSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const sidebarGroups = buildSidebarGroups(counts);

  useEffect(() => {
    setDesktopCollapsed(
      window.localStorage.getItem('zalen-admin-sidebar-collapsed') === 'true'
    );
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--admin-shell-sidebar-width',
      desktopCollapsed ? '4.5rem' : '15rem'
    );

    if (preferenceLoaded) {
      window.localStorage.setItem(
        'zalen-admin-sidebar-collapsed',
        String(desktopCollapsed)
      );
    }
  }, [desktopCollapsed, preferenceLoaded]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/6 bg-[#050C19]/95 px-3 backdrop-blur xl:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={platformBrand.logoWhite}
            alt={platformBrand.productName}
            className="h-4 w-auto shrink-0 select-none"
            draggable={false}
          />
          <span className="truncate text-xs font-semibold text-white">{storeShortName}</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-[#081225] text-slate-200"
          aria-label={mobileOpen ? 'Fechar navegação do admin' : 'Abrir navegação do admin'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#020713]/75 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar navegação do admin"
        />
      ) : null}

      <aside
        data-collapsed={desktopCollapsed}
        className={cn(
          'group/admin-sidebar fixed inset-y-0 left-0 z-50 w-60 overflow-y-auto border-r border-white/6 bg-[#050C19]/98 backdrop-blur transition-[transform,width] duration-200 xl:w-[var(--admin-shell-sidebar-width,15rem)] xl:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      <div className="flex h-full flex-col gap-4 px-3 py-4">
        <div className="rounded-lg border border-white/6 bg-[#071124] px-3 py-3">
          <div
            className={cn(
              'flex items-center justify-between gap-2',
              desktopCollapsed && 'xl:justify-center'
            )}
          >
            <img
              src={platformBrand.logoWhite}
              alt={platformBrand.productName}
              className={cn(
                'h-5 w-auto min-w-0 select-none',
                desktopCollapsed && 'xl:hidden'
              )}
              draggable={false}
            />
            <button
              type="button"
              onClick={() => setDesktopCollapsed((collapsed) => !collapsed)}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-[#081225] text-slate-300 transition hover:border-[#1E3DFF]/35 hover:text-white xl:inline-flex"
              aria-label={desktopCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              title={desktopCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            >
              {desktopCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
          <div
            className={cn(
              'mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-500',
              desktopCollapsed && 'xl:hidden'
            )}
          >
            Loja ativa
          </div>
          <div
            className={cn(
              'mt-0.5 truncate text-xs font-semibold text-white',
              desktopCollapsed && 'xl:hidden'
            )}
          >
            {storeShortName}
          </div>
        </div>

        <nav className="space-y-4">
          {sidebarGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div
                className={cn(
                  'px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600',
                  desktopCollapsed && 'xl:hidden'
                )}
              >
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
                      : 'border-transparent bg-transparent text-slate-400 hover:border-white/6 hover:bg-[#081225] hover:text-slate-200',
                  desktopCollapsed && 'xl:justify-center xl:px-2'
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
                      <span
                        className={cn(
                          'truncate font-medium',
                          desktopCollapsed && 'xl:hidden'
                        )}
                      >
                        {item.label}
                      </span>
                    </span>
                    {item.count ? (
                      <span
                        className={cn(
                          'text-[10px] uppercase tracking-[0.16em] text-slate-500',
                          desktopCollapsed && 'xl:hidden'
                        )}
                      >
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
                      title={desktopCollapsed ? item.label : undefined}
                      onClick={() => {
                        setMobileOpen(false);
                        onSelectView(item.viewKey!);
                      }}
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
                      title={desktopCollapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
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
                    title={desktopCollapsed ? item.label : undefined}
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
          <div
            className={cn(
              'rounded-lg border border-white/6 bg-[#081225] px-3 py-3',
              desktopCollapsed && 'xl:hidden'
            )}
          >
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
            onClick={() => setMobileOpen(false)}
            title={desktopCollapsed ? 'Voltar à loja' : undefined}
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/30 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(30,61,255,0.2)] transition hover:brightness-110',
              desktopCollapsed && 'xl:px-2'
            )}
          >
            <span className={cn(desktopCollapsed && 'xl:hidden')}>Voltar à loja</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      </aside>
    </>
  );
}
