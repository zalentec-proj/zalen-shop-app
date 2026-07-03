import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { createOptionalClient } from '@/lib/supabase/server';
import { getCustomerAccountForUser } from '@/modules/customer-account/customer-account.service';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import CustomerAccountHeader from '../CustomerAccountHeader';

export const metadata: Metadata = {
  title: 'Meus pedidos — Brasil Drones & Parts',
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    processing: 'Em separação',
    shipped: 'Enviado',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
    paid: 'Pago',
    failed: 'Falhou',
  };

  return labels[status] ?? status;
}

export default async function CustomerOrdersPage() {
  const supabase = await createOptionalClient();

  if (!supabase) {
    redirect('/conta/entrar?next=/conta/pedidos');
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/conta/entrar?next=/conta/pedidos');
  }

  const store = await resolveCurrentStoreFromHeaders();
  const account = await getCustomerAccountForUser({
    storeId: store.id,
    authUserId: data.user.id,
    email: data.user.email,
  });
  const orders = account?.orders ?? [];

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <CustomerAccountHeader email={data.user.email} />

        <Link
          href="/conta"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para minha conta
        </Link>

        <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-primary">
            Meus pedidos
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Histórico de compras
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            Pedidos salvos para {account?.customer.email ?? data.user.email}.
          </p>
        </section>

        <div className="grid gap-3">
          {orders.length > 0 ? (
            orders.map((order) => (
              <Link
                key={order.id}
                href={`/conta/pedidos/${order.id}`}
                className="grid gap-4 rounded-2xl border border-brand-border bg-[#090E17]/90 p-5 transition hover:border-blue-primary/40 sm:grid-cols-[1fr_140px_140px_120px]"
              >
                <div>
                  <div className="font-mono text-sm font-bold">{order.orderNumber}</div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {formatDate(order.createdAt)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-brand-muted">
                    <PackageCheck className="h-4 w-4 text-blue-primary" />
                    {order.items.length} item(ns)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
                    Total
                  </div>
                  <div className="mt-1 text-sm font-black">{formatCurrency(order.total)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
                    Pagamento
                  </div>
                  <div className="mt-1 text-sm font-bold">
                    {statusLabel(order.paymentStatus)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
                    Rastreio
                  </div>
                  <div className="mt-1 text-sm font-bold">
                    {order.shipments.length > 0 ? 'Disponível' : 'Pendente'}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-6 text-sm text-brand-muted">
              Nenhum pedido encontrado para esta conta.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
