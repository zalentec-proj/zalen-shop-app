import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AdminBadge, AdminEmptyState, AdminFilterBar, AdminPageFrame, AdminPageHeader, AdminPagination, AdminTableCard } from '@/components/admin/AdminLayout';
import { AdminDrawer } from '@/components/admin/AdminDrawer';
import { buildAdminListUrl, normalizeAdminPagination, type AdminListSearchParams } from '@/modules/admin/admin-pagination';
import { getOrderById, listOrdersPage } from '@/modules/orders/order.service';
import type { OrderStatus } from '@/modules/orders/order.types';
import { formatOrderMoney, orderPaymentLabels, orderStatusLabels } from '@/modules/orders/order-admin-summary';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { checkStoreRole } from '@/modules/auth/auth.service';
import { getShipmentsByOrderId } from '@/modules/shipping/shipment.service';
import { getLatestPaymentTransactionByOrderId } from '@/modules/payments/payment-transaction.repository';
import { getBlingOrderSendSettingsFromRepository } from '@/modules/integrations/bling/bling.repository';
import { OrderDetails } from './OrderDetails';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<AdminListSearchParams> }) {
  const params = await searchParams;
  const pagination = normalizeAdminPagination(params, 25);
  const status = Object.hasOwn(orderStatusLabels, params.status ?? '') ? params.status as OrderStatus : 'all';
  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, ['store_owner', 'store_admin', 'store_operator', 'store_viewer']);
  if (!access.allowed) return <AdminEmptyState title="Acesso restrito" description="Sua conta não possui acesso aos pedidos desta loja."/>;
  const canWrite = Boolean(access.platformRole || (access.membership && access.membership.role !== 'store_viewer'));
  const result = await listOrdersPage(store.id, { ...pagination, q: params.q, status });
  const query = { q: params.q, status: status === 'all' ? undefined : status };
  if (result.total > 0 && result.page > result.pageCount) redirect(buildAdminListUrl('/admin/pedidos', { ...query, record: params.record }, { page: result.pageCount, pageSize: result.pageSize }));
  const record = z.string().uuid().safeParse(params.record);
  // Copied detail links do not depend on the current page/filter containing the order.
  const selected = record.success ? await getOrderById(store.id, record.data) : null;
  const [shipments, payment, bling] = selected ? await Promise.all([
    getShipmentsByOrderId({ storeId: store.id, orderId: selected.id }),
    getLatestPaymentTransactionByOrderId({ storeId: store.id, orderId: selected.id }),
    getBlingOrderSendSettingsFromRepository(store.id),
  ]) : [[], null, null];
  const openHref = (id: string) => buildAdminListUrl('/admin/pedidos', { ...query, record: id }, { page: result.page, pageSize: result.pageSize });
  return <AdminPageFrame>
    <AdminPageHeader eyebrow="Operação" title="Pedidos" description="Confira pagamento, dados fiscais e entrega antes de dar andamento à venda."/>
    <div className="space-y-3 pt-4">
      {result.source !== 'supabase' && <p role="status" className="rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">Dados demonstrativos. Os pedidos reais estão indisponíveis neste ambiente; nenhuma operação será liberada.</p>}
      {params.record && !selected && <p role="status" className="text-sm text-amber-200">Não foi possível abrir este pedido. Confira o link e tente novamente.</p>}
      <AdminFilterBar action="/admin/pedidos" query={params.q} status={status} placeholder="Buscar pedido ou cliente…" statuses={[{ value: 'all', label: 'Todos os status' }, ...Object.entries(orderStatusLabels).map(([value, label]) => ({ value, label }))]}/>
      <AdminTableCard>{result.items.length ? <table className="w-full min-w-[860px] text-left text-xs">
        <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400"><tr>{['Pedido', 'Cliente', 'Total', 'Pagamento', 'Status', 'Criado em', 'Ação'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/10">{result.items.map(order => <tr key={order.id} className="hover:bg-white/[.025]">
          <td className="px-4 py-3 font-semibold text-white">#{order.orderNumber}</td>
          <td className="px-4 py-3"><div className="text-slate-200">{order.customerName ?? order.customer?.name ?? 'Não informado'}</div><div className="text-[11px] text-slate-400">{order.customerEmail ?? order.customer?.email}</div></td>
          <td className="px-4 py-3 text-slate-200">{formatOrderMoney(order.total)}</td>
          <td className="px-4 py-3"><AdminBadge tone={order.paymentStatus === 'paid' ? 'success' : 'warning'}>{orderPaymentLabels[order.paymentStatus]}</AdminBadge></td>
          <td className="px-4 py-3"><AdminBadge tone={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : order.status === 'pending' ? 'warning' : 'info'}>{orderStatusLabels[order.status]}</AdminBadge></td>
          <td className="px-4 py-3 text-slate-400">{new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(order.createdAt))}</td>
          <td className="px-4 py-3"><Link href={openHref(order.id)} scroll={false} className="font-semibold text-blue-300">Abrir</Link></td>
        </tr>)}</tbody>
      </table> : <AdminEmptyState title="Nenhum pedido encontrado" description="Altere a busca ou os filtros para visualizar outros pedidos."/>}
        <AdminPagination pathname="/admin/pedidos" page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} total={result.total} query={query}/>
      </AdminTableCard>
    </div>
    {selected && <AdminDrawer title={`Pedido #${selected.orderNumber}`} description={`${selected.customer?.name ?? selected.customerName ?? 'Cliente'} · ${formatOrderMoney(selected.total)}`}>
      <OrderDetails order={selected} payment={payment} shipments={shipments} canWrite={canWrite && result.source === 'supabase'} blingConnected={bling?.status === 'connected'} automaticSendEnabled={bling?.enabled ?? false}/>
    </AdminDrawer>}
  </AdminPageFrame>;
}
