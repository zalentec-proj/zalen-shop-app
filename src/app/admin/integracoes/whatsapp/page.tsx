import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/app/admin/AdminSidebar';
import { AdminPageFrame } from '@/components/admin/AdminLayout';
import { getCurrentUser, canAccessStore, checkStoreRole } from '@/modules/auth/auth.service';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { getOptionalStoreFromResolution, resolveStoreFromHeaders } from '@/modules/stores/store-resolution';
import { getWhatsAppAdminState } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service';
import { WhatsAppConnectionPanel } from './WhatsAppConnectionPanel';

export const metadata: Metadata = { title: 'Zalen Shop Admin — WhatsApp', ...noindexMetadata };
export const dynamic = 'force-dynamic';

export default async function WhatsAppIntegrationPage() {
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);
  if (!store) redirect('/');
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/admin/integracoes/whatsapp')}`);
  if (!(await canAccessStore(user.id, store.id))) redirect('/admin');
  const role = await checkStoreRole(store.id, ['store_owner', 'store_admin']);
  const state = await getWhatsAppAdminState(store.id);
  return <div className="min-h-screen bg-[#050A14] text-white"><AdminSidebar activeKey="whatsapp" storeShortName={store.shortName} footerLabel="Conectores" footerTitle="WhatsApp" footerDescription={`Mensagens transacionais para ${store.shortName}.`} /><main className="min-w-0 transition-[padding] duration-200 xl:pl-[var(--admin-shell-sidebar-width,15rem)]"><AdminPageFrame><header className="mb-6"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7EC3FF]">Integrações</p><h1 className="mt-2 text-3xl font-semibold">WhatsApp</h1><p className="mt-2 text-sm text-slate-400">Conexão e mensagens transacionais para {store.shortName}.</p></header><div className="mx-auto w-full max-w-5xl"><WhatsAppConnectionPanel initialState={state} />{!role.allowed ? <p className="mt-4 text-sm text-amber-200">Somente owner e admin podem conectar ou alterar as regras.</p> : null}</div></AdminPageFrame></main></div>;
}
