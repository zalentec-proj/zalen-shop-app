import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  PackageCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { createOptionalClient } from '@/lib/supabase/server';
import { getCustomerOrderForUser } from '@/modules/customer-account/customer-account.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import CustomerAccountHeader from '../../CustomerAccountHeader';

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

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Não informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    processing: 'Em separação',
    shipped: 'Enviado',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
    paid: 'Pago',
    failed: 'Falhou',
    approved: 'Aprovado',
    rejected: 'Recusado',
    created: 'Criado',
    posted: 'Postado',
    in_transit: 'Em transporte',
    out_for_delivery: 'Saiu para entrega',
    exception: 'Com ocorrência',
  };

  return labels[status ?? ''] ?? status ?? 'Pendente';
}

function shippingMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function CustomerOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createOptionalClient();

  if (!supabase) {
    redirect(`/conta/entrar?next=/conta/pedidos/${id}`);
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(`/conta/entrar?next=/conta/pedidos/${id}`);
  }

  const store = await resolveCurrentStoreFromHeaders();
  const order = await getCustomerOrderForUser({
    storeId: store.id,
    authUserId: data.user.id,
    email: data.user.email,
    orderId: id,
  });

  if (!order) {
    notFound();
  }

  const shippingChoice = [order.shippingCarrierName, order.shippingServiceName]
    .filter(Boolean)
    .join(' - ');
  const shippingDeliveryLabel = shippingMetadataString(
    order.shippingMetadata,
    'deliveryTimeLabel'
  );

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <CustomerAccountHeader email={data.user.email} />

        <Link
          href="/conta/pedidos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para pedidos
        </Link>

        <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-primary">
            Pedido
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                {order.orderNumber}
              </h1>
              <p className="mt-2 text-sm text-brand-muted">
                Criado em {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-brand-muted">Total</div>
              <div className="text-2xl font-black">{formatCurrency(order.total)}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoPanel
            icon={PackageCheck}
            title="Pedido"
            value={statusLabel(order.status)}
          />
          <InfoPanel
            icon={CreditCard}
            title="Pagamento"
            value={statusLabel(order.payment?.status ?? order.paymentStatus)}
          />
          <InfoPanel
            icon={Truck}
            title="Envio"
            value={
              order.shipments[0]
                ? statusLabel(order.shipments[0].status)
                : order.paymentStatus === 'paid'
                  ? 'Em separação'
                  : 'Rastreio pendente'
            }
          />
        </section>

        <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
          <h2 className="text-lg font-black">Itens</h2>
          <div className="mt-4 divide-y divide-white/8 overflow-hidden rounded-xl border border-white/8">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 bg-white/[0.02] p-4 sm:grid-cols-[1fr_80px_130px]"
              >
                <div>
                  <div className="font-bold">{item.name}</div>
                  {item.sku ? (
                    <div className="mt-1 font-mono text-xs text-brand-muted">
                      SKU {item.sku}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-brand-muted">
                  {item.quantity} un.
                </div>
                <div className="text-sm font-bold">{formatCurrency(item.total)}</div>
              </div>
            ))}
          </div>
        </section>

        {shippingChoice ? (
          <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
            <h2 className="text-lg font-black">Frete escolhido</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <InfoLine label="Serviço" value={shippingChoice} />
              <InfoLine
                label="Valor"
                value={formatCurrency(order.shippingTotal)}
              />
              <InfoLine label="Prazo estimado" value={shippingDeliveryLabel} />
            </div>
            {order.shipments.length === 0 ? (
              <p className="mt-4 text-sm text-brand-muted">
                Pedido aprovado. A loja está preparando o envio.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
          <h2 className="text-lg font-black">Rastreio</h2>
          <div className="mt-4 grid gap-3">
            {order.shipments.length > 0 ? (
              order.shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-4">
                    <InfoLine label="Transportadora" value={shipment.carrier} />
                    <InfoLine label="Código" value={shipment.trackingCode} />
                    <InfoLine label="Status" value={statusLabel(shipment.status)} />
                    <InfoLine label="Postado em" value={formatDate(shipment.shippedAt)} />
                  </div>
                  {shipment.trackingUrl ? (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-xl bg-blue-primary px-4 py-2 text-xs font-bold text-white"
                    >
                      Abrir rastreio
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-brand-muted">
                Aguardando expedição no Bling.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
      <Icon className="h-5 w-5 text-blue-primary" />
      <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-muted">
        {title}
      </div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold">{value ?? 'Não informado'}</div>
    </div>
  );
}
