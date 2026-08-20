import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock3, PackageCheck, ShieldCheck } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import { getGuestCheckoutOrderAccess } from '@/modules/payments/guest-checkout-access.service';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

export const metadata: Metadata = {
  title: 'Acompanhar pedido',
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const orderStatusLabels: Record<string, string> = {
  pending: 'Pedido recebido',
  confirmed: 'Pedido confirmado',
  processing: 'Em separação',
  shipped: 'Pedido enviado',
  delivered: 'Pedido entregue',
  cancelled: 'Pedido cancelado',
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'Aguardando confirmação',
  paid: 'Pagamento confirmado',
  failed: 'Pagamento não aprovado',
  refunded: 'Pagamento estornado',
};

function GuestOrderUnavailable() {
  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <main className="mx-auto flex max-w-lg px-4 py-20">
        <section className="glass-panel w-full rounded-[32px] p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-blue-primary" />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#9AABFF]">
            Acesso protegido
          </p>
          <h1 className="mt-2 text-2xl font-black">
            Este link não está mais disponível
          </h1>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Por segurança, o acompanhamento temporário expira. Entre com o mesmo
            e-mail usado na compra para recuperar seus pedidos.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/conta/entrar?next=/conta/pedidos"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-primary px-5 text-sm font-black text-white"
            >
              Entrar e recuperar
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-brand-border-soft px-5 text-sm font-bold text-brand-muted transition hover:text-white"
            >
              Voltar para a loja
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default async function GuestOrderPage({ params }: PageProps) {
  const [{ id }, store] = await Promise.all([
    params,
    resolveCurrentStoreFromHeaders(),
  ]);
  const access = await getGuestCheckoutOrderAccess({
    storeId: store.id,
    orderId: id,
  });

  if (!access) {
    return <GuestOrderUnavailable />;
  }

  const { order } = access;
  const isPaid = order.paymentStatus === 'paid';
  const accountPath = `/conta/cadastro?next=${encodeURIComponent(
    `/conta/pedidos/${order.id}`
  )}`;

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <main className="mx-auto max-w-3xl px-4 py-12 md:py-20">
        <section className="glass-panel overflow-hidden rounded-[32px]">
          <div className="border-b border-brand-border-soft p-6 md:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-accent/15">
                  {isPaid ? (
                    <CheckCircle2 className="h-6 w-6 text-green-accent" />
                  ) : (
                    <Clock3 className="h-6 w-6 text-yellow-300" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-muted">
                    Pedido {order.orderNumber}
                  </p>
                  <h1 className="mt-2 text-2xl font-black">
                    {orderStatusLabels[order.status] ?? 'Pedido recebido'}
                  </h1>
                  <p className="mt-2 text-sm text-brand-muted">
                    Criado em {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>
              <span
                className={`self-start rounded-full border px-3 py-1 text-xs font-bold ${
                  isPaid
                    ? 'border-green-accent/30 bg-green-accent/10 text-green-accent'
                    : 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
                }`}
              >
                {paymentStatusLabels[order.paymentStatus] ?? 'Pagamento pendente'}
              </span>
            </div>
          </div>

          <div className="grid gap-6 p-6 md:p-8">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-brand-muted">
                Itens
              </h2>
              <div className="mt-3 divide-y divide-brand-border-soft rounded-2xl border border-brand-border-soft">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{item.name}</p>
                      <p className="mt-1 text-xs text-brand-muted">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-white">
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-border-soft bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <PackageCheck className="h-4 w-4 text-blue-primary" />
                  Entrega
                </div>
                <p className="mt-2 text-xs leading-5 text-brand-muted">
                  {order.shippingServiceName ??
                    'A forma de envio será exibida no acompanhamento completo.'}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-border-soft bg-white/[0.02] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">
                  Total do pedido
                </p>
                <p className="mt-2 text-2xl font-black text-green-accent">
                  {formatCurrency(order.total)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-primary/25 bg-blue-primary/10 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-primary" />
                <div>
                  <h2 className="text-sm font-black text-white">
                    Guarde o pedido na sua conta
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-brand-muted">
                    Ative o acesso com o mesmo e-mail da compra para acompanhar
                    este e os próximos pedidos em qualquer dispositivo.
                  </p>
                </div>
              </div>
              <Link
                href={accountPath}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-primary px-5 text-sm font-black text-white transition hover:opacity-95 sm:w-auto"
              >
                Ativar acesso aos pedidos
              </Link>
            </div>

            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-brand-border-soft px-5 text-sm font-bold text-brand-muted transition hover:border-white/25 hover:text-white"
            >
              Continuar comprando
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
