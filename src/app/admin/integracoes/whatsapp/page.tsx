import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminPageFrame, AdminPageHeader } from '@/components/admin/AdminLayout';
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
  return <AdminPageFrame><AdminPageHeader eyebrow="Conectores" title="WhatsApp" description={`Conexão e preferências de mensagens para ${store.shortName}.`} /><div className="mx-auto mt-4 w-full max-w-5xl"><WhatsAppConnectionPanel initialState={state} />{!role.allowed ? <p className="mt-4 text-sm text-amber-200">Somente owner e admin podem conectar ou alterar as regras.</p> : null}</div></AdminPageFrame>;
}
