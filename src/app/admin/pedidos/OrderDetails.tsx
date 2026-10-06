import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminBadge } from '@/components/admin/AdminLayout';
import { AdminActionForm } from '@/components/admin/AdminActionForm';
import type { OrderListItem } from '@/modules/orders/order.types';
import type { PaymentTransaction } from '@/modules/payments/payment-transaction.types';
import type { Shipment } from '@/modules/shipping/shipment.types';
import { formatOrderMoney, getBlingOrderErrorMessage, getOrderAdminSummary, orderPaymentLabels, orderStatusLabels } from '@/modules/orders/order-admin-summary';
import { sendOrderToBlingAction, upsertOrderShipmentAction } from '../orders/actions';

const fieldClass = 'mt-1 h-10 w-full min-w-0 rounded-lg border border-white/10 bg-[#050A14] px-3 text-sm';
function Field({ label, children }: { label: string; children?: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm text-slate-100">{children || 'Não informado'}</dd></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-xl border border-white/10 p-4"><h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>{children}</section>;
}

export function OrderDetails({ order, payment, shipments, canWrite, blingConnected, automaticSendEnabled }: {
  order: OrderListItem; payment: PaymentTransaction | null; shipments: Shipment[];
  canWrite: boolean; blingConnected: boolean; automaticSendEnabled: boolean;
}) {
  const summary = getOrderAdminSummary(order, payment);
  const address = order.customer?.shippingAddress;
  const shipment = shipments[0];
  const linked = order.externalErpProvider === 'bling' && Boolean(order.externalErpId);
  const locked = ['bling_order_send_in_progress', 'bling_order_send_uncertain'].includes(order.externalErpLastError ?? '');
  const operable = canWrite && order.paymentStatus === 'paid' && order.status !== 'cancelled';
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <AdminBadge tone="info">{orderStatusLabels[order.status]}</AdminBadge>
      <AdminBadge tone={order.paymentStatus === 'paid' ? 'success' : 'warning'}>{orderPaymentLabels[order.paymentStatus]}</AdminBadge>
      <span className="text-xs text-slate-400">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(order.createdAt))}</span>
    </div>
    <p className="text-xs leading-5 text-slate-400">Dados registrados no momento da compra. Preços e dados do pedido não são substituídos pelo cadastro atual.</p>
    {summary.missingFiscalData.length > 0 && <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">Dados fiscais ausentes: {summary.missingFiscalData.join(', ')}. Confira com o comprador antes de emitir a nota.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Comprador e dados fiscais"><dl className="grid gap-3 sm:grid-cols-2">
        <Field label={summary.customerType === 'pj' ? 'Responsável' : 'Nome'}>{order.customer?.name ?? order.customerName}</Field>
        <Field label="Tipo de cliente">{summary.customerType === 'pj' ? 'Pessoa jurídica' : 'Pessoa física'}</Field>
        <Field label={summary.customerType === 'pj' ? 'CNPJ' : 'CPF'}>{order.customer?.document}</Field>
        {summary.customerType === 'pj' && <><Field label="Razão social">{summary.legalName}</Field><Field label="Inscrição estadual">{summary.stateRegistrationExempt ? 'Isento' : summary.stateRegistration}</Field></>}
        <Field label="E-mail">{order.customer?.email ?? order.customerEmail}</Field><Field label="Telefone">{order.customer?.phone}</Field>
      </dl></Section>
      <Section title="Entrega"><dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Destinatário">{address?.recipientName ?? order.customer?.name}</Field><Field label="Telefone da entrega">{address?.phone ?? order.customer?.phone}</Field>
        <Field label="Rua e número">{[address?.street, address?.number].filter(Boolean).join(', ')}</Field><Field label="Complemento">{address?.complement}</Field>
        <Field label="Bairro">{address?.district}</Field><Field label="Cidade / UF">{[address?.city, address?.state].filter(Boolean).join(' / ')}</Field>
        <Field label="CEP">{address?.postalCode}</Field><Field label="País">{address?.country}</Field>
        <Field label="Modalidade">{order.shippingServiceName}</Field><Field label="Transportadora escolhida">{order.shippingCarrierName}</Field>
        <Field label="Prazo cotado">{order.shippingDeliveryMaxDays !== undefined ? `${order.shippingDeliveryMinDays ?? order.shippingDeliveryMaxDays} a ${order.shippingDeliveryMaxDays} dias úteis` : undefined}</Field>
      </dl></Section>
    </div>
    <Section title="Itens do pedido"><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="pb-2">Produto / SKU</th><th className="px-2 pb-2 text-right">Qtd.</th><th className="px-2 pb-2 text-right">Unitário</th><th className="pb-2 text-right">Total</th></tr></thead><tbody className="divide-y divide-white/10">{order.items.map(item => <tr key={item.id}><td className="py-3 pr-2"><p>{item.name}</p><p className="text-xs text-slate-400">SKU: {item.sku ?? 'Não informado'}</p></td><td className="px-2 text-right">{item.quantity}</td><td className="whitespace-nowrap px-2 text-right">{formatOrderMoney(item.unitPrice)}</td><td className="whitespace-nowrap text-right">{formatOrderMoney(item.total)}</td></tr>)}</tbody></table></div></Section>
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Resumo financeiro"><dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt>Produtos (preços finais)</dt><dd>{formatOrderMoney(order.subtotal)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Frete</dt><dd>{formatOrderMoney(order.shippingTotal)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Desconto no pedido</dt><dd>− {formatOrderMoney(order.discountTotal)}</dd></div>
        <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold"><dt>Total</dt><dd>{formatOrderMoney(order.total)}</dd></div>
      </dl>{order.productDiscountTotal > 0 && <p className="mt-3 text-xs text-slate-400">Economia de {formatOrderMoney(order.productDiscountTotal)} já incluída nos preços dos itens; não descontar novamente.</p>}</Section>
      <Section title="Pagamento"><dl className="grid gap-3 sm:grid-cols-2"><Field label="Situação">{orderPaymentLabels[order.paymentStatus]}</Field><Field label="Meio de pagamento">{summary.paymentMethod}</Field><Field label="Confirmado em">{payment?.approvedAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(payment.approvedAt)) : undefined}</Field></dl></Section>
    </div>
    <Section title="Bling e nota fiscal">
      {linked ? <p role="status" className="text-sm text-emerald-300">Pedido enviado ao Bling. Localize pela referência {order.orderNumber} para conferir os dados e gerar a nota fiscal.</p> : <>
        <p role="status" className="text-sm text-slate-300">{locked ? getBlingOrderErrorMessage(order.externalErpLastError) : 'Este pedido ainda não tem um vínculo confirmado com o Bling.'}</p>
        {order.externalErpLastError && !locked && <p className="mt-2 text-sm text-amber-200">{getBlingOrderErrorMessage(order.externalErpLastError)}</p>}
        {!blingConnected && <p className="mt-2 text-sm text-amber-200">Conecte o Bling em <Link href="/admin/integracoes/bling" className="underline">Integrações → Bling</Link> antes de enviar.</p>}
        <p className="mt-2 text-xs text-slate-400">Envio automático: {automaticSendEnabled ? 'ligado' : 'desligado'}. O envio manual não altera essa configuração, não emite nota e não movimenta a expedição aqui.</p>
        {operable && blingConnected && !locked && summary.missingFiscalData.length === 0 && <AdminActionForm action={sendOrderToBlingAction} pendingMessage="Enviando pedido ao Bling…" successMessage="Pedido enviado ao Bling." className="mt-4 space-y-3">
          <input type="hidden" name="orderId" value={order.id}/>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmation" value="send" required className="mt-1"/><span>Conferi os dados e confirmo a criação deste pedido real no Bling. Ele não foi cadastrado manualmente por lá.</span></label>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Enviar pedido ao Bling</button>
        </AdminActionForm>}
      </>}
      <p className="mt-3 text-xs leading-5 text-slate-400">A nota fiscal é gerada e revisada no Bling. NCM, tributação e demais regras fiscais continuam no cadastro do ERP. Contatos já existentes no Bling são preservados e devem ser conferidos antes do faturamento.</p>
    </Section>
    {operable ? <AdminActionForm action={upsertOrderShipmentAction} successMessage="Dados de envio salvos com sucesso." className="space-y-3 rounded-xl border border-white/10 p-4">
      <input type="hidden" name="orderId" value={order.id}/><h3 className="text-sm font-semibold">Separação e envio</h3>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-300">Transportadora<input name="carrier" defaultValue={shipment?.carrier ?? order.shippingCarrierName ?? ''} className={fieldClass}/></label><label className="text-xs text-slate-300">Código de rastreio<input name="trackingCode" defaultValue={shipment?.trackingCode ?? ''} className={fieldClass}/></label><label className="text-xs text-slate-300 sm:col-span-2">Link de rastreio<input name="trackingUrl" type="url" defaultValue={shipment?.trackingUrl ?? ''} className={fieldClass}/></label></div>
      <label className="block text-xs text-slate-300">Situação do envio<select name="status" defaultValue={shipment?.status ?? 'pending'} className={fieldClass}><option value="pending">Preparando</option><option value="posted">Postado</option><option value="in_transit">Em trânsito</option><option value="out_for_delivery">Saiu para entrega</option><option value="delivered">Entregue</option><option value="exception">Ocorrência na entrega</option><option value="cancelled">Envio cancelado</option></select></label>
      <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Salvar envio</button>
    </AdminActionForm> : <p className="text-sm text-slate-400">{!canWrite ? 'Modo de consulta: seu perfil não permite alterar este pedido.' : order.status === 'cancelled' ? 'Este pedido está cancelado. A operação de envio está bloqueada.' : 'A separação será liberada após a confirmação do pagamento.'}</p>}
    <details className="rounded-lg border border-white/10 p-3 text-xs text-slate-400"><summary className="cursor-pointer">Detalhes técnicos</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="ID do pedido">{order.id}</Field><Field label="ID no Bling">{order.externalErpId}</Field><Field label="ID do pagamento">{payment?.externalPaymentId}</Field></dl></details>
  </div>;
}
