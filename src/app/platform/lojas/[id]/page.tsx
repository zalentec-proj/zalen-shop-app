import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformAccess } from '@/modules/platform/platform-access';
import { getManagedStore } from '@/modules/platform/store-management.service';
import { PresentationForm, PublicationForm } from '@/components/platform/StoreManagementForms';
import { getLoginNavigationContext } from '@/modules/auth/login-destination.service';
import { getStoreAdminUrl } from '@/modules/auth/operational-navigation';

export const metadata = { title: 'Personalizar loja — Zalen Shop' };
export default async function ManagedStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { role } = await requirePlatformAccess();
  const { id } = await params;
  const detail = await getManagedStore(id);
  if (!detail) notFound();
  const { store, config, revision, publishedRevision, ownerEmail } = detail;
  const { requestOrigin, rootDomain } = await getLoginNavigationContext();
  return <div className="max-w-5xl">
    <Link href="/platform/lojas" className="text-xs text-blue-300">← Lojas</Link>
    <div className="mb-6 mt-5 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[11px] uppercase tracking-widest text-blue-300">Personalização</p><h1 className="mt-2 text-2xl font-semibold">{store.name}</h1>
        <p className="mt-2 break-all text-xs text-slate-400">{store.slug}.{rootDomain} · {store.status === 'active' ? 'Ativa' : store.status === 'planned' ? 'Em preparação' : 'Inativa'}</p>
      </div>
      <div className="flex gap-4 text-sm text-blue-300">
        <Link href={`/platform/lojas/${id}/preview`}>Ver prévia do rascunho ↗</Link>
        {store.status === 'active' ? <a href={getStoreAdminUrl(store.slug, requestOrigin, rootDomain) ?? undefined}>Abrir painel ↗</a> : null}
      </div>
    </div>
    <section className="mb-5 rounded-xl border border-white/10 bg-[#081225] p-5 text-sm">
      <p>Responsável: <span className="text-slate-400">{ownerEmail ?? 'Consulte os vínculos operacionais da loja.'}</span></p>
      <p className="mt-2 text-xs text-slate-500">Endereço fixo nesta etapa. Produtos, contatos e integrações pertencem exclusivamente a esta loja.</p>
    </section>
    <PresentationForm key={id} storeId={id} name={store.name} config={config} revision={revision} />
    <section className="mt-6 rounded-xl border border-white/10 bg-[#081225] p-5">
      <h2 className="text-base font-semibold">Publicação</h2>
      <p className="mb-4 mt-2 text-sm text-slate-400">{publishedRevision === revision ? 'A versão salva está publicada.' : 'Há um rascunho para conferir e publicar.'} Ativar libera o endereço público; desativar retira a loja do ar.</p>
      {role === 'platform_owner' ? <PublicationForm key={`${id}:${revision}:${store.status}`} storeId={id} revision={revision} active={store.status === 'active'} /> : <p className="text-xs text-slate-400">A publicação e a desativação são feitas pelo dono da plataforma.</p>}
    </section>
  </div>;
}
