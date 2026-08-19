import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  PackageCheck,
  ReceiptText,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { createOptionalClient } from '@/lib/supabase/server';
import { getCustomerAccountForUser } from '@/modules/customer-account/customer-account.service';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import CustomerAccountHeader from './CustomerAccountHeader';
import BusinessProfileForm from './BusinessProfileForm';
import WhatsAppContactForm from './WhatsAppContactForm';
import { getCustomerWhatsAppContactState } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service';

export const metadata: Metadata = {
  title: 'Minha conta — Brasil Drones & Parts',
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

export default async function CustomerAccountPage() {
  const supabase = await createOptionalClient();

  if (!supabase) {
    redirect('/conta/entrar?next=/conta');
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/conta/entrar?next=/conta');
  }

  const store = await resolveCurrentStoreFromHeaders();
  const account = await getCustomerAccountForUser({
    storeId: store.id,
    authUserId: data.user.id,
    email: data.user.email,
  });

  const latestOrders = account?.orders.slice(0, 3) ?? [];
  const whatsappContact = account?.customer
    ? await getCustomerWhatsAppContactState({
        storeId: store.id,
        customerId: account.customer.id,
      })
    : null;
  const paidOrders = account?.orders.filter((order) => order.paymentStatus === 'paid').length ?? 0;
  const shippedOrders =
    account?.orders.filter((order) => order.shipments.length > 0).length ?? 0;
  const metrics: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    {
      label: 'Pedidos',
      value: account?.orders.length ?? 0,
      Icon: ReceiptText,
    },
    {
      label: 'Pagos',
      value: paidOrders,
      Icon: PackageCheck,
    },
    {
      label: 'Com rastreio',
      value: shippedOrders,
      Icon: Truck,
    },
  ];

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <CustomerAccountHeader email={data.user.email} />

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-6">
            <h1 className="text-3xl font-black tracking-tight">
              Olá, {account?.customer.name ?? data.user.email}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
              Acompanhe seus pedidos, pagamentos e entregas.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {metrics.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-4"
              >
                <Icon className="h-4 w-4 text-blue-primary" />
                <div className="mt-4 text-2xl font-black">{value}</div>
                <div className="mt-1 text-[11px] font-semibold text-brand-muted">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {account?.customer ? (
          <BusinessProfileForm customer={account.customer} />
        ) : null}

        {account?.customer ? (
          <WhatsAppContactForm
            initialPhone={whatsappContact?.phoneE164}
            initialVerified={whatsappContact?.verified}
            initialOptedIn={whatsappContact?.optedIn}
          />
        ) : null}

        <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Pedidos recentes</h2>
              <p className="mt-1 text-sm text-brand-muted">
                Acompanhe suas compras recentes.
              </p>
            </div>
            <Link
              href="/conta/pedidos"
              className="rounded-xl border border-blue-primary/40 px-4 py-2 text-xs font-bold text-blue-primary transition hover:bg-blue-primary hover:text-white"
            >
              Ver todos
            </Link>
          </div>

          <div className="mt-5 divide-y divide-white/8 overflow-hidden rounded-xl border border-white/8">
            {latestOrders.length > 0 ? (
              latestOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/conta/pedidos/${order.id}`}
                  className="grid gap-2 bg-white/[0.02] p-4 transition hover:bg-white/[0.04] sm:grid-cols-[1fr_120px_120px_120px]"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-white">
                      {order.orderNumber}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm font-bold">{formatCurrency(order.total)}</div>
                  <div className="text-xs font-semibold text-brand-muted">
                    {statusLabel(order.paymentStatus)}
                  </div>
                  <div className="text-xs font-semibold text-brand-muted">
                    {statusLabel(order.status)}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-5 text-sm text-brand-muted">
                Nenhum pedido vinculado a esta conta ainda.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
