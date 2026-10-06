import type { OrderListItem, OrderStatus, PaymentStatus } from './order.types';
import type { PaymentTransaction } from '@/modules/payments/payment-transaction.types';

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação',
  shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado',
};
export const orderPaymentLabels: Record<PaymentStatus, string> = {
  pending: 'Aguardando pagamento', paid: 'Pago', failed: 'Pagamento não aprovado', refunded: 'Reembolsado',
};

export function formatOrderMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function getBlingOrderErrorMessage(code?: string) {
  const messages: Record<string, string> = {
    bling_order_send_disabled: 'O envio automático está desligado. Você pode enviar este pedido manualmente após conectar o Bling.',
    bling_not_connected: 'Conecte a conta Bling da loja antes de enviar o pedido.',
    invalid_bling_credentials: 'Reconecte a conta Bling para renovar a autorização.',
    order_payment_not_approved: 'O pedido precisa estar pago para ser enviado ao Bling.',
    order_cancelled: 'Pedidos cancelados não podem ser enviados ao Bling.',
    order_missing_customer_data: 'O pedido não possui nome ou CPF/CNPJ suficiente para o envio.',
    order_missing_company_fiscal_data: 'O pedido PJ precisa de razão social e inscrição estadual ou isenção. Confira os dados antes de enviar.',
    order_not_found: 'Este pedido não foi encontrado nesta loja. Atualize a página e confira o link.',
    order_missing_items: 'O pedido não possui itens para enviar.',
    order_item_missing_sku: 'Há um item sem SKU. Confira o cadastro antes de enviar.',
    bling_product_not_found_for_sku: 'Um SKU do pedido não foi encontrado no Bling. Confira os produtos na conta conectada.',
    order_send_already_running: 'Este pedido já tem um envio em andamento. Aguarde e atualize a tela.',
    bling_order_send_in_progress: 'O envio deste pedido foi iniciado. Confira o Bling antes de qualquer nova tentativa.',
    bling_order_send_uncertain: 'Não foi possível confirmar o resultado do envio. Confira o pedido no Bling antes de reenviar para evitar duplicidade.',
  };
  if (code && messages[code]) return messages[code];
  if (code?.endsWith('_401') || code?.endsWith('_403')) return 'A autorização do Bling foi recusada. Confira as permissões da conta e reconecte a integração.';
  if (code?.endsWith('_429')) return 'O Bling limitou as requisições. Aguarde antes de tentar novamente.';
  return 'Não foi possível concluir o envio. Confira a conexão e os dados do pedido.';
}

export function getOrderAdminSummary(order: OrderListItem, payment?: PaymentTransaction | null) {
  const customerType = order.customerType ?? order.customer?.customerType ??
    (order.customer?.document?.replace(/\D/g, '').length === 14 ? 'pj' : 'pf');
  const stateRegistrationExempt = order.customerStateRegistrationExempt ?? order.customer?.stateRegistrationExempt;
  const legalName = order.customerLegalName ?? order.customer?.legalName;
  const stateRegistration = order.customerStateRegistration ?? order.customer?.stateRegistration;
  const method = payment?.metadata?.payment_method_id;
  const type = payment?.metadata?.payment_type_id;
  const paymentMethod = method === 'pix' ? 'Pix' : type === 'ticket' ? 'Boleto' :
    type === 'credit_card' ? 'Cartão de crédito' : type === 'debit_card' ? 'Cartão de débito' :
    payment ? 'Mercado Pago' : 'Não informado';
  const missingFiscalData = [
    !order.customer?.document && 'CPF/CNPJ',
    !(order.customer?.name ?? order.customerName) && 'nome',
    customerType === 'pj' && !legalName && 'razão social',
    customerType === 'pj' && !stateRegistrationExempt && !stateRegistration && 'inscrição estadual ou isenção',
  ].filter((value): value is string => Boolean(value));
  return { customerType, legalName, stateRegistration, stateRegistrationExempt, paymentMethod, missingFiscalData };
}
