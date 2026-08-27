import { AlertCircle, Package2, ShoppingCart, UsersRound, Waypoints } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminDataList, AdminDataListRow, AdminKpiCard, AdminKpiGrid, AdminPageFrame, AdminPageHeader, AdminSectionCard } from '@/components/admin/AdminLayout';
import { listAdminProductsPage } from '@/modules/catalog/product.service';
import { listCustomersPage } from '@/modules/customers/customer.service';
import { listStoreIntegrationsWithSource } from '@/modules/integrations/core/store-integration.service';
import { listOrdersPage } from '@/modules/orders/order.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const legacyRoutes: Record<string, string> = { orders: '/admin/pedidos', products: '/admin/produtos', customers: '/admin/clientes', integrations: '/admin/integracoes', settings: '/admin/configuracoes' };

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = typeof params.view === 'string' ? params.view : undefined;
  if (view && view !== 'dashboard' && legacyRoutes[view]) {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'view' && typeof value === 'string') next.set(key, value);
    });
    redirect(`${legacyRoutes[view]}${next.size ? `?${next.toString()}` : ''}`);
  }
  const store = await resolveCurrentStoreFromHeaders();
  const [products, orders, customers, integrations] = await Promise.all([
    listAdminProductsPage(store.id, { page: 1, pageSize: 25, status: 'all' }),
    listOrdersPage(store.id, { page: 1, pageSize: 25, status: 'all' }),
    listCustomersPage(store.id, { page: 1, pageSize: 25, status: 'all' }),
    listStoreIntegrationsWithSource(store.id),
  ]);
  const pendingOrders = orders.items.filter((order) => order.status === 'pending' || order.externalErpSyncStatus === 'error');
  const connected = integrations.data.filter((item) => item.integration?.status === 'connected').length;
  return <AdminPageFrame><AdminPageHeader eyebrow="Operação" title="Visão geral" description={`O que pede atenção agora em ${store.shortName}.`} /><div className="space-y-4 pt-4"><AdminKpiGrid><AdminKpiCard icon={ShoppingCart} label="Pedidos" value={String(orders.total)} helper={`${pendingOrders.length} na fila prioritária desta página`} /><AdminKpiCard icon={Package2} label="Produtos" value={String(products.total)} helper="Catálogo administrável da loja" /><AdminKpiCard icon={UsersRound} label="Clientes" value={String(customers.total)} helper="Perfis vinculados à loja" /><AdminKpiCard icon={Waypoints} label="Integrações" value={`${connected}/${integrations.data.length}`} helper="Conectores ativos" /></AdminKpiGrid><div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]"><AdminSectionCard title="Fila prioritária" description="Pedidos recentes que ainda precisam de ação." action={<Link href="/admin/pedidos" className="text-xs font-semibold text-blue-300">Ver pedidos</Link>}>{pendingOrders.length ? <AdminDataList>{pendingOrders.slice(0, 5).map((order) => <AdminDataListRow key={order.id} leading={<AlertCircle className="h-4 w-4 text-amber-300" />} title={`Pedido ${order.orderNumber}`} description={order.customerName ?? order.customer?.name ?? 'Cliente não informado'} meta={<span>R$ {order.total.toFixed(2).replace('.', ',')}</span>} action={<Link href={`/admin/pedidos?record=${order.id}`} className="text-blue-300">Abrir</Link>} />)}</AdminDataList> : <p className="py-8 text-center text-xs text-slate-400">Nenhum pedido prioritário nesta página.</p>}</AdminSectionCard><AdminSectionCard title="Próximas ações" description="Atalhos para tarefas frequentes."><div className="grid gap-2">{[['Revisar catálogo', '/admin/produtos'], ['Organizar menu público', '/admin/configuracoes/loja-online'], ['Ver saúde dos conectores', '/admin/integracoes']].map(([label, href]) => <Link key={href} href={href} className="rounded-lg border border-white/7 bg-[#081225] px-3 py-3 text-xs font-semibold text-slate-200 transition hover:border-blue-400/30 hover:text-white">{label}</Link>)}</div></AdminSectionCard></div></div></AdminPageFrame>;
}
