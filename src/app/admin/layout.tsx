import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { platformBrand } from '@/lib/branding/platform-brand';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { getCurrentUser, getPlatformRole, getStoreMembership } from '@/modules/auth/auth.service';
import { getOptionalStoreFromResolution, resolveStoreFromHeaders } from '@/modules/stores/store-resolution';
import { AdminShell } from './AdminShell';

export const metadata: Metadata = {
  title: `${platformBrand.productName} Admin`,
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, resolution] = await Promise.all([
    getCurrentUser(),
    resolveStoreFromHeaders(),
  ]);
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) notFound();
  if (!user) redirect('/login');

  const [platformRole, membership] = await Promise.all([
    getPlatformRole(user.id),
    getStoreMembership(user.id, store.id),
  ]);

  if (!platformRole && !membership) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050A14] px-6 text-white">
        <section className="w-full max-w-md rounded-xl border border-white/10 bg-[#0A1730] p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">Acesso restrito</p>
          <h1 className="mt-3 text-2xl font-semibold">Sem permissão para esta loja</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sua conta não possui vínculo com {store.name}.
          </p>
          <Link href={store.storefrontPath} className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">
            Voltar para a loja
          </Link>
        </section>
      </main>
    );
  }

  return (
    <AdminShell
      storeShortName={store.shortName}
      user={{ email: user.email, role: platformRole ?? membership!.role }}
    >
      {children}
    </AdminShell>
  );
}
