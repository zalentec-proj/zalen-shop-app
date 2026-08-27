'use client';

import { LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/login/actions';
import type { PlatformRole, StoreRole } from '@/modules/auth/auth.types';
import { AdminSidebar, type AdminSidebarKey } from './AdminSidebar';

type AdminAccessRole = PlatformRole | StoreRole;

const roleLabels: Record<AdminAccessRole, string> = {
  platform_owner: 'Zalen owner',
  platform_admin: 'Zalen admin',
  store_owner: 'Dono da loja',
  store_admin: 'Admin da loja',
  store_operator: 'Operador',
  store_viewer: 'Leitor',
};

function getActiveKey(pathname: string): AdminSidebarKey {
  if (pathname === '/admin') return 'dashboard';
  if (pathname.startsWith('/admin/pedidos')) return 'orders';
  if (pathname.startsWith('/admin/produtos')) return 'products';
  if (pathname.startsWith('/admin/clientes')) return 'customers';
  if (pathname === '/admin/integracoes') return 'integrations';
  if (pathname.startsWith('/admin/integracoes/bling')) return 'bling';
  if (pathname.startsWith('/admin/integracoes/whatsapp')) return 'whatsapp';
  if (pathname.startsWith('/admin/integracoes/marketing')) return 'marketing';
  if (pathname.startsWith('/admin/integracoes/mercado-pago')) return 'payments';
  if (pathname.startsWith('/admin/configuracoes/loja-online')) return 'storefront';
  if (pathname.startsWith('/admin/configuracoes/precos')) return 'pricing';
  if (pathname.startsWith('/admin/configuracoes/pagamentos')) return 'payments';
  if (pathname.startsWith('/admin/configuracoes/envios')) return 'shipping';
  if (pathname.startsWith('/admin/configuracoes/dominios')) return 'domains';
  return 'settings';
}

function getInitials(email?: string) {
  const local = email?.split('@')[0] ?? 'admin';
  return local
    .split(/[._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AdminShell({
  storeShortName,
  user,
  children,
}: {
  storeShortName: string;
  user: { email?: string; role: AdminAccessRole };
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="admin-theme min-h-screen min-w-0 bg-[var(--admin-canvas)] text-[13px] text-slate-100">
      <AdminSidebar
        activeKey={getActiveKey(pathname)}
        storeShortName={storeShortName}
        footerLabel="Zalen Shop"
        footerTitle="Admin da loja"
        footerDescription="Operação centralizada e segura."
      />
      <main className="min-w-0 transition-[padding] duration-200 xl:pl-[var(--admin-shell-sidebar-width,15rem)]">
        <div className="sticky top-0 z-30 border-b border-white/6 bg-[#050A14]/90 px-3 py-2 backdrop-blur-xl sm:px-4 lg:px-6">
          <div className="mx-auto flex max-w-[1480px] justify-end gap-2">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/7 bg-[#081225] px-2.5 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-[10px] font-bold text-white">
                {getInitials(user.email)}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-48 truncate text-[11px] font-semibold text-white">
                  {user.email ?? 'Administrador'}
                </span>
                <span className="block text-[10px] text-slate-500">{roleLabels[user.role]}</span>
              </span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-full items-center gap-2 rounded-lg border border-white/7 bg-[#081225] px-3 text-xs font-medium text-slate-300 transition hover:border-white/15 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
