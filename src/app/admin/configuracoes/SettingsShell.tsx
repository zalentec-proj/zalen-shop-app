'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import type { PlatformRole, StoreRole } from '@/modules/auth/auth.types';
import { logoutAction } from '@/app/login/actions';
import { currentStoreBrand } from '@/lib/branding/current-store-brand';
import { platformBrand } from '@/lib/branding/platform-brand';
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Box,
  Building2,
  ChevronRight,
  Code2,
  CreditCard,
  FileText,
  Globe2,
  Home,
  Languages,
  LayoutGrid,
  Link2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Package2,
  PencilLine,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Truck,
  UserRound,
  UsersRound,
  Waypoints,
} from 'lucide-react';

type AdminAccessRole = PlatformRole | StoreRole;

interface SettingsShellProps {
  adminUser: {
    email?: string;
    role: AdminAccessRole;
  };
  children: ReactNode;
}

interface PrimaryNavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  count: string;
  active?: boolean;
}

interface SettingsNavItem {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
}

interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

const accessRoleLabel: Record<AdminAccessRole, string> = {
  platform_owner: 'Zalen owner',
  platform_admin: 'Zalen admin',
  store_owner: 'Dono da loja',
  store_admin: 'Admin da loja',
  store_operator: 'Operador',
  store_viewer: 'Leitor',
};

const primaryNavItems: PrimaryNavItem[] = [
  {
    label: 'Visão geral',
    href: '/admin?view=dashboard',
    icon: LayoutGrid,
    count: '01',
  },
  {
    label: 'Produtos',
    href: '/admin?view=products',
    icon: Package2,
    count: '06',
  },
  {
    label: 'Pedidos',
    href: '/admin?view=orders',
    icon: ShoppingCart,
    count: '00',
  },
  {
    label: 'Integrações',
    href: '/admin?view=integrations',
    icon: Waypoints,
    count: '04',
  },
  {
    label: 'Configurações',
    href: '/admin/configuracoes',
    icon: Settings2,
    count: '02',
    active: true,
  },
];

const settingsNavGroups: SettingsNavGroup[] = [
  {
    label: 'Pagamentos e envios',
    items: [
      { label: 'Meios de pagamento', href: '/admin/configuracoes/pagamentos', icon: CreditCard },
      { label: 'Meios de envio', href: '/admin/configuracoes/envios', icon: Truck },
      { label: 'Centros de distribuição', icon: Building2 },
    ],
  },
  {
    label: 'Documentos fiscais',
    items: [
      { label: 'Notas fiscais', icon: ReceiptText },
      { label: 'Declaração de conteúdo', icon: FileText },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { label: 'Informações de contato', icon: Mail },
      { label: 'Botão de WhatsApp', icon: MessageCircle },
      { label: 'E-mails automáticos', icon: Bell },
    ],
  },
  {
    label: 'Checkout',
    items: [
      { label: 'Opções de checkout', icon: ShoppingCart },
      { label: 'Mensagem para clientes', icon: MessageCircle },
    ],
  },
  {
    label: 'Loja',
    items: [
      { label: 'Usuários e permissões', icon: UsersRound },
      { label: 'Domínios', href: '/admin/configuracoes/dominios', icon: Globe2 },
      { label: 'Códigos externos', icon: Code2 },
      { label: 'Idiomas e moedas', icon: Languages },
      { label: 'Redirecionamentos 301', icon: Link2 },
      { label: 'Campos personalizados', icon: PencilLine },
    ],
  },
];

function initialsFromName(name?: string) {
  if (!name) return 'AD';

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function SettingsShell({ adminUser, children }: SettingsShellProps) {
  const pathname = usePathname();
  const adminInitials = initialsFromEmail(adminUser.email);
  const adminEmail = adminUser.email ?? 'admin autenticado';
  const adminRoleLabel = accessRoleLabel[adminUser.role];

  return (
    <div className="min-h-screen bg-[#050A14] text-[13px] text-slate-100">
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

          <nav className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.active;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition',
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
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2">
            <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Sistema
              </div>
              <div className="mt-1 text-xs font-semibold text-white">
                Configurações da loja
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Regras visuais e operacionais da {currentStoreBrand.shortName}.
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

      <main className="xl:pl-60">
        <div className="px-3 py-3 sm:px-4 lg:px-5">
          <div className="rounded-lg border border-white/6 bg-[#071124]/92 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.2)] sm:p-4">
            <header className="flex flex-col gap-3 border-b border-white/6 pb-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-400 transition hover:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar ao painel
                </Link>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#7EC3FF]">
                  Configurações da loja
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white sm:text-2xl">
                    Configurações
                  </h1>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                    Operação, canais e preferências da loja ativa dentro da Zalen Shop.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/6 bg-[#081225] px-3 py-2">
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
                    className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-rose-400/35 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sair
                  </button>
                </form>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Exportar visão
                </button>
              </div>
            </header>

            <div className="grid gap-4 pt-4 2xl:grid-cols-[280px,1fr]">
              <aside className="space-y-3">
                <Link
                  href="/admin/configuracoes"
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition',
                    pathname === '/admin/configuracoes'
                      ? 'border-[#1E3DFF]/35 bg-[#101F43] text-white'
                      : 'border-white/6 bg-[#081225] text-slate-300 hover:border-[#1E3DFF]/25 hover:text-white'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Home className="h-3.5 w-3.5" />
                    Visão geral
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>

                {settingsNavGroups.map((group) => (
                  <div key={group.label} className="rounded-lg border border-white/6 bg-[#081225] p-2">
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.href === pathname;

                        if (!item.href) {
                          return (
                            <div
                              key={item.label}
                              className="flex items-center justify-between rounded-md px-2 py-2 text-xs text-slate-500"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </span>
                              <span className="text-[10px]">Planejado</span>
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                              'flex items-center justify-between rounded-md px-2 py-2 text-xs transition',
                              isActive
                                ? 'bg-[#1E3DFF]/14 text-[#A9C7FF]'
                                : 'text-slate-300 hover:bg-white/[0.03] hover:text-white'
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </aside>

              <section className="min-w-0">{children}</section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function SettingsPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-white/6 bg-[#0A1730]/95', className)}>
      {(title || description || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/6 px-4 py-3">
          <div className="space-y-1">
            {title ? <h2 className="text-sm font-semibold text-white">{title}</h2> : null}
            {description ? (
              <p className="max-w-2xl text-xs leading-5 text-slate-400">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function SettingsBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'disabled' | 'info';
  children: ReactNode;
}) {
  const toneClass = {
    neutral: 'border-white/8 bg-[#081225] text-slate-300',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    disabled: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
    info: 'border-[#1E3DFF]/30 bg-[#1E3DFF]/10 text-[#A9C7FF]',
  }[tone];

  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold', toneClass)}>
      {children}
    </span>
  );
}

export function SettingsActionButton({
  children,
  disabled,
  variant = 'secondary',
}: {
  children: ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition',
        variant === 'primary'
          ? 'border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] text-white shadow-[0_10px_20px_rgba(30,61,255,0.2)] hover:brightness-110'
          : 'border border-white/8 bg-[#081225] text-slate-200 hover:border-[#1E3DFF]/35 hover:text-white',
        disabled && 'cursor-not-allowed opacity-60 hover:brightness-100'
      )}
    >
      {children}
    </button>
  );
}

export { Box, MapPin, ShieldCheck, Store };
