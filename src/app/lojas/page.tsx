import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OperationalShell } from '@/components/platform/OperationalShell';
import { StoreList } from '@/components/platform/StoreList';
import { getCurrentUser, getPlatformRole } from '@/modules/auth/auth.service';
import { listUserStores } from '@/modules/auth/store-access.repository';
import { getLoginNavigationContext } from '@/modules/auth/login-destination.service';
import { getSafeLoginNextTarget, isAdminPath } from '@/modules/auth/login-navigation';
import { noindexMetadata } from '@/modules/seo/seo.service';
import type { StoreRow } from '@/modules/stores/store.types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Minhas lojas — Zalen Shop', ...noindexMetadata };

export default async function StoreSelectionPage({ searchParams }: { searchParams?: Promise<{ acesso?: string; next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/lojas');
  if (await getPlatformRole(user.id)) redirect('/platform/lojas');
  const params = await searchParams;
  const { requestOrigin, rootDomain } = await getLoginNavigationContext();
  const safeNext = getSafeLoginNextTarget(params?.next, requestOrigin, rootDomain);
  // Only a relative admin path may be applied to every listed store.
  const adminPath = safeNext.startsWith('/') && isAdminPath(new URL(safeNext, requestOrigin).pathname) ? safeNext : '/admin';
  let stores: StoreRow[] = [];
  let available = true;
  try {
    stores = await listUserStores(user.id);
  } catch {
    available = false;
  }

  return (
    <OperationalShell email={user.email}>
      <h1 className="text-2xl font-semibold tracking-tight">Minhas lojas</h1>
      <p className="mb-6 mt-2 text-sm text-slate-400">Escolha a loja que deseja gerenciar.</p>
      {params?.acesso === 'restrito' ? (
        <p role="alert" className="mb-5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
          Você não tem permissão para acessar a área solicitada. Escolha uma das suas lojas.
        </p>
      ) : null}
      {!available ? (
        <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-100">
          Não foi possível carregar seus acessos. Atualize a página para tentar novamente.
        </p>
      ) : stores.length ? (
        <StoreList stores={stores} requestOrigin={requestOrigin} rootDomain={rootDomain} adminPath={adminPath} />
      ) : (
        <div className="rounded-xl border border-white/8 bg-[#081225] p-6">
          <h2 className="font-semibold">Nenhuma loja disponível para esta conta</h2>
          <p className="mt-2 text-sm text-slate-400">Solicite seu acesso ao responsável pela loja ou saia para entrar com outra conta.</p>
        </div>
      )}
    </OperationalShell>
  );
}
