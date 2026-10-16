import type { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, LogOut, ShieldCheck } from 'lucide-react';
import { logoutAction } from '@/app/login/actions';
import { platformBrand } from '@/lib/branding/platform-brand';

export function OperationalShell({ children, email, platform = false, roleLabel }: {
  children: ReactNode;
  email?: string;
  platform?: boolean;
  roleLabel?: string;
}) {
  return (
    <div className="admin-theme min-h-screen bg-[var(--admin-canvas)] text-[13px] text-slate-100">
      <header className="border-b border-white/8 bg-[#050A14] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link href={platform ? '/platform/lojas' : '/lojas'} aria-label="Zalen Shop — lojas">
            <img src={platformBrand.logoWhite} alt="Zalen Shop" className="h-9 w-auto max-w-44" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="min-w-0 text-right">
              <p className="max-w-48 truncate text-xs text-slate-200">{email ?? 'Sua conta'}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{roleLabel ?? 'Acesso às lojas'}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8">
        <nav aria-label="Área de gestão" className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-white/7 pb-4">
          <Link href={platform ? '/platform/lojas' : '/lojas'} aria-current="page" className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300">
            <Building2 className="h-4 w-4" aria-hidden="true" />{platform ? 'Todas as lojas' : 'Minhas lojas'}
          </Link>
          {platform ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Administração da plataforma
            </span>
          ) : null}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
