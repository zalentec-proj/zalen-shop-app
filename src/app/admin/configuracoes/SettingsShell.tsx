'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminSidebar, type AdminSidebarKey } from '@/app/admin/AdminSidebar';
import {
  AdminPageFrame,
  AdminSectionCard,
} from '@/components/admin/AdminLayout';
import type { PlatformRole, StoreRole } from '@/modules/auth/auth.types';
import { logoutAction } from '@/app/login/actions';
import {
  ArrowLeft,
  Box,
  LogOut,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Store,
} from 'lucide-react';

type AdminAccessRole = PlatformRole | StoreRole;

interface SettingsShellProps {
  storeShortName: string;
  adminUser: {
    email?: string;
    role: AdminAccessRole;
  };
  children: ReactNode;
}

const accessRoleLabel: Record<AdminAccessRole, string> = {
  platform_owner: 'Zalen owner',
  platform_admin: 'Zalen admin',
  store_owner: 'Dono da loja',
  store_admin: 'Admin da loja',
  store_operator: 'Operador',
  store_viewer: 'Leitor',
};

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

function getSettingsSidebarKey(pathname: string): AdminSidebarKey {
  if (pathname.startsWith('/admin/configuracoes/loja-online')) return 'storefront';
  if (pathname.startsWith('/admin/configuracoes/pagamentos')) return 'payments';
  if (pathname.startsWith('/admin/configuracoes/envios')) return 'shipping';
  if (pathname.startsWith('/admin/configuracoes/dominios')) return 'domains';

  return 'settings';
}

function getSettingsPageMeta(pathname: string) {
  if (pathname.startsWith('/admin/configuracoes/loja-online')) {
    return {
      title: 'Loja online',
      description: 'Categorias, navbar e experiência pública da loja ativa.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/pagamentos')) {
    return {
      title: 'Meios de pagamento',
      description: 'Formas de recebimento disponíveis ou planejadas para a loja ativa.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/envios')) {
    return {
      title: 'Meios de envio',
      description: 'Opções de entrega, retirada e logística previstas para a operação.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/dominios')) {
    return {
      title: 'Domínios',
      description: 'Domínio padrão, domínio próprio e orientação visual de DNS.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/compatibilidade')) {
    return {
      title: 'Compatibilidade por modelo',
      description: 'Vínculos auditáveis entre peças, acessórios e os modelos DJI da loja ativa.',
    };
  }

  return {
    title: 'Configurações',
    description: 'Operação, canais e preferências da loja ativa dentro da Zalen Shop.',
  };
}

export function SettingsShell({
  storeShortName,
  adminUser,
  children,
}: SettingsShellProps) {
  const pathname = usePathname();
  const pageMeta = getSettingsPageMeta(pathname);
  const adminInitials = initialsFromEmail(adminUser.email);
  const adminEmail = adminUser.email ?? 'admin autenticado';
  const adminRoleLabel = accessRoleLabel[adminUser.role];

  return (
    <div className="min-h-screen min-w-0 bg-[#050A14] text-[13px] text-slate-100">
      <AdminSidebar
        activeKey={getSettingsSidebarKey(pathname)}
        storeShortName={storeShortName}
        footerLabel="Sistema"
        footerTitle="Configurações da loja"
        footerDescription="Regras visuais e operacionais da loja ativa."
      />

      <main className="min-w-0 transition-[padding] duration-200 xl:pl-[var(--admin-shell-sidebar-width,15rem)]">
        <AdminPageFrame>
            <header className="flex flex-col gap-3 border-b border-white/6 pb-4 xl:flex-row xl:items-center xl:justify-between">
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
                    {pageMeta.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                    {pageMeta.description}
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
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Exportação indisponível
                </button>
              </div>
            </header>

            <section className="pt-4">{children}</section>
        </AdminPageFrame>
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
