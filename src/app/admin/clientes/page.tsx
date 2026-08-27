import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminDrawer } from '@/components/admin/AdminDrawer';
import { AdminActionForm } from '@/components/admin/AdminActionForm';
import { AdminBadge, AdminEmptyState, AdminFilterBar, AdminPageFrame, AdminPageHeader, AdminPagination, AdminTableCard } from '@/components/admin/AdminLayout';
import { buildAdminListUrl, normalizeAdminPagination, type AdminListSearchParams } from '@/modules/admin/admin-pagination';
import { listCustomersPage } from '@/modules/customers/customer.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { createAdminCustomerAction } from '../customers/actions';

type CustomerParams = AdminListSearchParams & { new?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<CustomerParams> }) {
  const params = await searchParams;
  const pagination = normalizeAdminPagination(params, 25);
  const status = params.status === 'pf' || params.status === 'pj' ? params.status : 'all';
  const store = await resolveCurrentStoreFromHeaders();
  const result = await listCustomersPage(store.id, { ...pagination, q: params.q, status });
  if (result.total > 0 && result.page > result.pageCount) redirect(buildAdminListUrl('/admin/clientes', { q: params.q, status: status === 'all' ? undefined : status, record: params.record, new: params.new }, { page: result.pageCount, pageSize: result.pageSize }));
  const selected = result.items.find((item) => item.id === params.record);
  const withQuery = (entries: Record<string,string>) => buildAdminListUrl('/admin/clientes', { q: params.q, status: status === 'all' ? undefined : status, page: String(result.page), pageSize: String(result.pageSize) }, entries);

  return <AdminPageFrame>
    <AdminPageHeader eyebrow="Relacionamento" title="Clientes" description="Perfis, histórico e contato sem sobrecarregar a listagem." actions={<Link href={withQuery({ new: 'customer' })} scroll={false} className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Novo cliente</Link>} />
    <div className="space-y-3 pt-4">
      <AdminFilterBar action="/admin/clientes" query={params.q} status={status} placeholder="Buscar nome ou e-mail…" statuses={[{ value: 'all', label: 'Todos os clientes' }, { value: 'pf', label: 'Pessoa física' }, { value: 'pj', label: 'Pessoa jurídica' }]} />
      <AdminTableCard>
        {result.items.length ? <table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-white/7 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Pedidos</th><th className="px-4 py-3">Total comprado</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-white/6">{result.items.map((customer) => <tr key={customer.id} className="hover:bg-white/[.025]"><td className="px-4 py-3"><div className="font-semibold text-white">{customer.name}</div><div className="text-[11px] text-slate-500">{customer.email ?? customer.phone ?? 'Sem contato informado'}</div></td><td className="px-4 py-3"><AdminBadge tone={customer.customerType === 'pj' ? 'info' : 'neutral'}>{customer.customerType === 'pj' ? 'Pessoa jurídica' : 'Pessoa física'}</AdminBadge></td><td className="px-4 py-3 text-slate-300">{customer.ordersCount}</td><td className="px-4 py-3 text-slate-300">R$ {customer.totalSpent.toFixed(2).replace('.', ',')}</td><td className="px-4 py-3 text-right"><Link href={withQuery({ record: customer.id })} scroll={false} className="font-semibold text-blue-300">Abrir</Link></td></tr>)}</tbody></table> : <AdminEmptyState title="Nenhum cliente encontrado" description="Altere a busca ou cadastre um novo cliente." />}
        <AdminPagination pathname="/admin/clientes" page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} total={result.total} query={{ q: params.q, status: status === 'all' ? undefined : status }} />
      </AdminTableCard>
    </div>
    {params.new === 'customer' ? <AdminDrawer parameter="new" presentation="modal" title="Novo cliente" description="Cadastre apenas os dados essenciais."><AdminActionForm action={createAdminCustomerAction} successMessage="Cliente cadastrado com sucesso." pendingMessage="Cadastrando cliente…" className="grid gap-3"><label className="grid gap-1 text-xs">Nome<input required name="name" className="h-9 rounded-lg border border-white/8 bg-[#050A14] px-3" /></label><label className="grid gap-1 text-xs">E-mail<input type="email" name="email" className="h-9 rounded-lg border border-white/8 bg-[#050A14] px-3" /></label><label className="grid gap-1 text-xs">Telefone<input name="phone" className="h-9 rounded-lg border border-white/8 bg-[#050A14] px-3" /></label><label className="grid gap-1 text-xs">CPF ou CNPJ<input name="document" className="h-9 rounded-lg border border-white/8 bg-[#050A14] px-3" /></label><label className="grid gap-1 text-xs">Observações<textarea name="notes" rows={3} className="rounded-lg border border-white/8 bg-[#050A14] p-3" /></label><button className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold">Cadastrar cliente</button></AdminActionForm></AdminDrawer> : null}
    {selected ? <AdminDrawer title={selected.name} description={selected.email ?? selected.phone ?? 'Dados do cliente'}><div className="space-y-4"><dl className="grid gap-3 rounded-lg border border-white/7 p-4 text-xs"><div><dt className="text-slate-500">Pedidos</dt><dd className="mt-1 text-white">{selected.ordersCount}</dd></div><div><dt className="text-slate-500">Total comprado</dt><dd className="mt-1 text-white">R$ {selected.totalSpent.toFixed(2).replace('.', ',')}</dd></div><div><dt className="text-slate-500">Contato</dt><dd className="mt-1 text-white">{selected.email ?? selected.phone ?? 'Não informado'}</dd></div></dl>{selected.notes ? <section><h3 className="text-xs font-semibold text-slate-300">Observações</h3><p className="mt-2 text-xs leading-5 text-slate-400">{selected.notes}</p></section> : null}</div></AdminDrawer> : null}
  </AdminPageFrame>;
}
