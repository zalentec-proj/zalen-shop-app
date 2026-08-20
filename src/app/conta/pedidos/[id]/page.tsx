import type { Metadata } from 'next';
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
import { getMercadoPagoPayment } from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import type {
  MercadoPagoEnvironment,
  MercadoPagoPaymentInstructions,
} from '@/modules/integrations/mercado-pago/mercado-pago.types';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import CustomerAccountHeader from '../../CustomerAccountHeader';
import BoletoInstructionActions from './BoletoInstructionActions';
import PendingPaymentAutoRefresh from './PendingPaymentAutoRefresh';
import { retryCustomerOrderPaymentAction } from './actions';

export const metadata: Metadata = {
  title: 'Detalhe do pedido — Brasil Drones & Parts',
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    payment?: string;
  }>;
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

function paymentStatusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    created: 'Pagamento iniciado',
    pending: 'Aguardando pagamento',
    approved: 'Pago',
    paid: 'Pago',
    rejected: 'Recusado',
    cancelled: 'Cancelado',
    refunded: 'Estornado',
    failed: 'Falhou',
    error: 'Com erro',
  };

  return labels[status ?? ''] ?? statusLabel(status);
}

function paymentNoticeLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    already_paid: 'Este pedido já está pago.',
    unavailable: 'Este pedido não permite novo pagamento.',
    mercado_pago_error:
      'O Mercado Pago não conseguiu gerar um novo checkout agora.',
    pending:
      'Pagamento gerado. Conclua pelo Mercado Pago ou use a opção abaixo para continuar.',
    retry_error: 'Não foi possível iniciar um novo pagamento agora.',
  };

  return value ? labels[value] : undefined;
}

function shippingMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getMetadataRecord(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeMetadataString(value: string | undefined) {
  return value?.trim().toLowerCase();
}

type PaymentInstructionsDisplay = {
  method: 'pix' | 'ticket' | 'external';
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  barcodeContent?: string;
  digitableLine?: string;
  reference?: string;
  financialInstitution?: string;
  expiresAt?: string;
};

function toPaymentInstructionsDisplay(
  instructions: MercadoPagoPaymentInstructions | undefined
): PaymentInstructionsDisplay | undefined {
  const pix = instructions?.pix;
  const ticket = instructions?.ticket;
  const ticketUrl = pix?.ticketUrl ?? instructions?.externalResourceUrl;
  const isPix = Boolean(pix?.qrCode || pix?.qrCodeBase64);
  const isTicket = Boolean(
    ticket ||
      (ticketUrl && !isPix)
  );

  if (!pix?.qrCode && !pix?.qrCodeBase64 && !ticketUrl && !ticket) {
    return undefined;
  }

  return {
    method: isPix ? 'pix' : isTicket ? 'ticket' : 'external',
    qrCode: pix?.qrCode,
    qrCodeBase64: pix?.qrCodeBase64,
    ticketUrl,
    barcodeContent: ticket?.barcodeContent,
    digitableLine: ticket?.digitableLine,
    reference: ticket?.reference,
    financialInstitution: ticket?.financialInstitution,
    expiresAt: instructions?.expiresAt ?? pix?.expiresAt,
  };
}

function getPaymentInstructions(payment: CustomerOrderDetailPagePayment | undefined) {
  const instructions = getMetadataRecord(payment?.metadata, 'payment_instructions');
  const pix = getMetadataRecord(instructions, 'pix');
  const ticket = getMetadataRecord(instructions, 'ticket');

  return toPaymentInstructionsDisplay({
    pix: pix
      ? {
          qrCode: getMetadataString(pix, 'qrCode'),
          qrCodeBase64: getMetadataString(pix, 'qrCodeBase64'),
          ticketUrl: getMetadataString(pix, 'ticketUrl'),
          expiresAt: getMetadataString(pix, 'expiresAt'),
        }
      : undefined,
    ticket: ticket
      ? {
          barcodeContent: getMetadataString(ticket, 'barcodeContent'),
          digitableLine: getMetadataString(ticket, 'digitableLine'),
          reference: getMetadataString(ticket, 'reference'),
          financialInstitution: getMetadataString(ticket, 'financialInstitution'),
        }
      : undefined,
    externalResourceUrl: getMetadataString(instructions, 'externalResourceUrl'),
    expiresAt: getMetadataString(instructions, 'expiresAt'),
  });
}

function mergePaymentInstructions(
  stored: PaymentInstructionsDisplay | undefined,
  refreshed: PaymentInstructionsDisplay | undefined
) {
  if (!stored) return refreshed;
  if (!refreshed) return stored;

  return {
    method:
      stored.method === 'ticket' || refreshed.method === 'ticket'
        ? 'ticket'
        : stored.method,
    qrCode: stored.qrCode ?? refreshed.qrCode,
    qrCodeBase64: stored.qrCodeBase64 ?? refreshed.qrCodeBase64,
    ticketUrl: stored.ticketUrl ?? refreshed.ticketUrl,
    barcodeContent: stored.barcodeContent ?? refreshed.barcodeContent,
    digitableLine: stored.digitableLine ?? refreshed.digitableLine,
    reference: stored.reference ?? refreshed.reference,
    financialInstitution:
      stored.financialInstitution ?? refreshed.financialInstitution,
    expiresAt: stored.expiresAt ?? refreshed.expiresAt,
  } satisfies PaymentInstructionsDisplay;
}

async function resolvePaymentInstructions(input: {
  payment: CustomerOrderDetailPagePayment | undefined;
  storeId: string;
}) {
  const stored = getPaymentInstructions(input.payment);
  const needsBoletoRefresh =
    stored?.method === 'ticket' &&
    !stored.barcodeContent &&
    !stored.digitableLine &&
    input.payment?.externalPaymentId;

  if (!needsBoletoRefresh || !input.payment?.externalPaymentId) {
    return stored;
  }

  const environment: MercadoPagoEnvironment =
    getMetadataString(input.payment.metadata, 'environment') === 'production'
      ? 'production'
      : 'test';

  try {
    const payment = await getMercadoPagoPayment({
      paymentId: input.payment.externalPaymentId,
      storeId: input.storeId,
      environment,
    });

    return mergePaymentInstructions(
      stored,
      toPaymentInstructionsDisplay(payment.paymentInstructions)
    );
  } catch {
    return stored;
  }
}

function getPaymentPendingTitle(payment: CustomerOrderDetailPagePayment | undefined) {
  const instructions = getPaymentInstructions(payment);
  const paymentMethodId = normalizeMetadataString(
    getMetadataString(payment?.metadata, 'payment_method_id')
  );
  const paymentTypeId = normalizeMetadataString(
    getMetadataString(payment?.metadata, 'payment_type_id')
  );

  if (instructions?.method === 'pix' || paymentMethodId === 'pix') {
    return 'Pix aguardando pagamento';
  }

  if (
    instructions?.method === 'ticket' ||
    paymentTypeId === 'ticket' ||
    paymentMethodId?.startsWith('bol')
  ) {
    return 'Boleto aguardando pagamento';
  }

  if (paymentTypeId === 'credit_card' || paymentTypeId === 'debit_card') {
    return 'Pagamento com cartão em análise';
  }

  return 'Pagamento pendente';
}

function getPaymentPendingDescription(
  payment: CustomerOrderDetailPagePayment | undefined
) {
  const instructions = getPaymentInstructions(payment);
  const paymentMethodId = normalizeMetadataString(
    getMetadataString(payment?.metadata, 'payment_method_id')
  );
  const paymentTypeId = normalizeMetadataString(
    getMetadataString(payment?.metadata, 'payment_type_id')
  );

  if (instructions?.method === 'pix' || paymentMethodId === 'pix') {
    return 'Use o QR Code, copie o código Pix ou continue pelo Mercado Pago.';
  }

  if (
    instructions?.method === 'ticket' ||
    paymentTypeId === 'ticket' ||
    paymentMethodId?.startsWith('bol')
  ) {
    return 'Abra o boleto oficial pelo Mercado Pago para visualizar ou pagar.';
  }

  if (paymentTypeId === 'credit_card' || paymentTypeId === 'debit_card') {
    return 'O Mercado Pago ainda está analisando a cobrança. A confirmação chegará automaticamente.';
  }

  return 'Continue pelo Mercado Pago ou gere uma nova tentativa para o mesmo pedido.';
}

type CustomerOrderDetailPagePayment = NonNullable<
  Awaited<ReturnType<typeof getCustomerOrderForUser>>
>['payment'];

function getPaymentContinuationUrl(payment: CustomerOrderDetailPagePayment | undefined) {
  if (!payment) {
    return undefined;
  }

  const environment = getMetadataString(payment.metadata, 'environment');

  return environment === 'test'
    ? payment.sandboxCheckoutUrl ?? payment.checkoutUrl
    : payment.checkoutUrl ?? payment.sandboxCheckoutUrl;
}

export default async function CustomerOrderDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const search = await searchParams;
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
  const effectivePaymentStatus = order.payment?.status ?? order.paymentStatus;
  const isPaid =
    order.paymentStatus === 'paid' || order.payment?.status === 'approved';
  const canRetryPayment =
    !isPaid &&
    order.status !== 'cancelled' &&
    order.paymentStatus !== 'refunded' &&
    order.payment?.status !== 'refunded';
  const paymentNotice = isPaid ? undefined : paymentNoticeLabel(search?.payment);
  const paymentInstructions = await resolvePaymentInstructions({
    payment: order.payment,
    storeId: store.id,
  });
  const paymentContinuationUrl = getPaymentContinuationUrl(order.payment);
  const paymentPendingTitle = getPaymentPendingTitle(order.payment);
  const paymentPendingDescription = getPaymentPendingDescription(order.payment);
  const isTicketPayment = paymentInstructions?.method === 'ticket';
  const isAwaitingPaymentConfirmation =
    effectivePaymentStatus === 'created' || effectivePaymentStatus === 'pending';
  const paymentInstructionExpiresAt = paymentInstructions?.expiresAt
    ? new Date(paymentInstructions.expiresAt).getTime()
    : undefined;
  const hasExpiredPaymentInstructions =
    paymentInstructionExpiresAt !== undefined &&
    Number.isFinite(paymentInstructionExpiresAt) &&
    paymentInstructionExpiresAt <= Date.now();
  const canGenerateNewPaymentAttempt =
    canRetryPayment &&
    (!isAwaitingPaymentConfirmation ||
      !paymentInstructions ||
      hasExpiredPaymentInstructions);

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
            value={paymentStatusLabel(effectivePaymentStatus)}
          />
          <InfoPanel
            icon={Truck}
            title="Envio"
            value={
              order.shipments[0]
                ? statusLabel(order.shipments[0].status)
                : isPaid
                  ? 'Em separação'
                  : 'Rastreio pendente'
            }
          />
        </section>

        {paymentNotice ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
            {paymentNotice}
          </div>
        ) : null}

        {canRetryPayment ? (
          <section className="rounded-2xl border border-blue-primary/30 bg-blue-primary/10 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black">{paymentPendingTitle}</h2>
                <p className="mt-1 text-sm text-brand-muted">
                  {paymentPendingDescription}
                </p>
                {isAwaitingPaymentConfirmation &&
                !hasExpiredPaymentInstructions ? (
                  <PendingPaymentAutoRefresh
                    expiresAt={paymentInstructions?.expiresAt}
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                {paymentContinuationUrl && !isTicketPayment ? (
                  <a
                    href={paymentContinuationUrl}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-primary px-5 text-sm font-black text-white shadow-[0_8px_24px_rgba(30,61,255,0.28)] transition hover:opacity-95"
                  >
                    Continuar pagamento
                  </a>
                ) : null}
                {canGenerateNewPaymentAttempt ? (
                  <form action={retryCustomerOrderPaymentAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button
                      type="submit"
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-blue-primary/40 px-5 text-sm font-black text-blue-primary transition hover:bg-blue-primary/10"
                    >
                      Gerar nova tentativa
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
            {paymentInstructions ? (
              <div
                className={`mt-5 grid gap-4 rounded-2xl border border-white/10 bg-[#050A14]/70 p-4 ${
                  paymentInstructions.method === 'pix' && paymentInstructions.qrCodeBase64
                    ? 'md:grid-cols-[180px_1fr]'
                    : ''
                }`}
              >
                {paymentInstructions.method === 'pix' && paymentInstructions.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${paymentInstructions.qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="h-44 w-44 rounded-xl bg-white p-2"
                  />
                ) : null}
                <div>
                  <h3 className="text-sm font-black">
                    {paymentInstructions.method === 'pix'
                      ? 'Pix aguardando pagamento'
                      : paymentInstructions.method === 'ticket'
                        ? 'Boleto aguardando pagamento'
                        : 'Pagamento aguardando conclusão'}
                  </h3>
                  <p className="mt-1 text-sm text-brand-muted">
                    {paymentInstructions.method === 'pix'
                      ? 'Use o QR Code, copie o código Pix ou continue pelo Mercado Pago.'
                      : paymentInstructions.method === 'ticket'
                        ? 'Use o código abaixo para pagar ou abra o documento oficial do Mercado Pago.'
                        : 'Abra as instruções no Mercado Pago para concluir.'}
                  </p>
                  {paymentInstructions.method === 'pix' && paymentInstructions.qrCode ? (
                    <textarea
                      readOnly
                      value={paymentInstructions.qrCode}
                      className="mt-3 h-24 w-full rounded-xl border border-white/10 bg-[#090E17] p-3 font-mono text-xs text-white"
                    />
                  ) : null}
                  {paymentInstructions.method === 'pix' ? (
                    <>
                      {paymentInstructions.expiresAt ? (
                        <p
                          className={`mt-3 text-xs font-semibold ${
                            hasExpiredPaymentInstructions
                              ? 'text-rose-200'
                              : 'text-amber-100'
                          }`}
                        >
                          {hasExpiredPaymentInstructions
                            ? `Este Pix venceu em ${formatDate(paymentInstructions.expiresAt)}. Gere uma nova tentativa para pagar.`
                            : `Pix válido até ${formatDate(paymentInstructions.expiresAt)}.`}
                        </p>
                      ) : null}
                      <BoletoInstructionActions
                        method="pix"
                        paymentCode={paymentInstructions.qrCode}
                        ticketUrl={paymentInstructions.ticketUrl}
                      />
                    </>
                  ) : null}
                  {paymentInstructions.method === 'ticket' ? (
                    <>
                      {paymentInstructions.digitableLine ||
                      paymentInstructions.barcodeContent ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-[#090E17] p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
                            {paymentInstructions.digitableLine
                              ? 'Linha digitável'
                              : 'Código de barras'}
                          </p>
                          <p className="mt-2 break-all font-mono text-xs font-bold leading-6 text-white">
                            {paymentInstructions.digitableLine ??
                              paymentInstructions.barcodeContent}
                          </p>
                        </div>
                      ) : null}
                      {paymentInstructions.expiresAt ? (
                        <p className="mt-3 text-xs text-brand-muted">
                          Vencimento: {formatDate(paymentInstructions.expiresAt)}
                        </p>
                      ) : null}
                      {paymentInstructions.reference ? (
                        <p className="mt-1 text-xs text-brand-muted">
                          Referência: {paymentInstructions.reference}
                        </p>
                      ) : null}
                      <BoletoInstructionActions
                        paymentCode={
                          paymentInstructions.digitableLine ??
                          paymentInstructions.barcodeContent
                        }
                        ticketUrl={paymentInstructions.ticketUrl}
                      />
                      {paymentInstructions.ticketUrl ? (
                        <p className="mt-3 text-xs text-brand-muted">
                          Para imprimir ou baixar, use as opções do documento oficial do Mercado Pago.
                        </p>
                      ) : null}
                    </>
                  ) : paymentInstructions.method !== 'pix' && paymentInstructions.ticketUrl ? (
                    <a
                      href={paymentInstructions.ticketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-xs font-black text-white transition hover:border-blue-primary/40"
                    >
                      Abrir instruções no Mercado Pago
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

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
                <div className="text-right">
                  {item.productDiscountTotal > 0 ? (
                    <div className="text-xs text-brand-muted line-through">
                      {formatCurrency(item.baseUnitPrice * item.quantity)}
                    </div>
                  ) : null}
                  <div className="text-sm font-bold">
                    {formatCurrency(item.total)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {order.productDiscountTotal > 0 ? (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-green-accent/20 bg-green-accent/10 px-4 py-3 text-sm">
              <span className="font-semibold text-brand-muted">
                Economia nos produtos
              </span>
              <span className="font-black text-green-accent">
                {formatCurrency(order.productDiscountTotal)}
              </span>
            </div>
          ) : null}
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
                {isPaid
                  ? 'Pedido aprovado. A loja está preparando o envio.'
                  : 'A loja prepara o envio depois da aprovação do pagamento.'}
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
                {isPaid
                  ? 'O rastreio será disponibilizado assim que o pedido for enviado.'
                  : 'Rastreio será exibido depois da aprovação do pagamento.'}
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
