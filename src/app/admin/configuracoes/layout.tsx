import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';
import { currentStoreBrand } from '@/lib/branding/current-store-brand';
import { platformBrand } from '@/lib/branding/platform-brand';
import {
  getCurrentUser,
  getPlatformRole,
  getStoreMembership,
} from '@/modules/auth/auth.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { SettingsShell } from './SettingsShell';

export const metadata: Metadata = {
  title: `Configurações — ${platformBrand.productName} Admin`,
};

export const dynamic = 'force-dynamic';

function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#0A1730]/90 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
          Acesso restrito
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Sem permissão para esta loja
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sua conta está autenticada, mas não possui vínculo com{' '}
          {currentStoreBrand.name} nem acesso global da plataforma.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg bg-blue-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2f68ff]"
            >
              Sair
            </button>
          </form>
          <Link
            href={currentStoreBrand.storefrontPath}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Voltar para a loja
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const [platformRole, membership] = await Promise.all([
    getPlatformRole(user.id),
    getStoreMembership(user.id, ACTIVE_STORE_ID),
  ]);

  if (!platformRole && !membership) {
    return <AccessDenied />;
  }

  return (
    <SettingsShell
      adminUser={{
        email: user.email,
        role: platformRole ?? membership!.role,
      }}
    >
      {children}
    </SettingsShell>
  );
}
