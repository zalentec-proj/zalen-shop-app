import type { OrderListItem } from '@/modules/orders/order.types';
import type { BlingOrderDraft } from './bling-order.types';

function toMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function onlyDigits(value: string | undefined) {
  return value?.replace(/\D/g, '') || undefined;
}

function toDateOnly(value: string | undefined) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function toBlingPersonType(
  customerType: OrderListItem['customerType'],
  document: string | undefined
) {
  const digits = onlyDigits(document);

  if (customerType === 'pj' || digits?.length === 14) {
    return 'J' as const;
  }

  if (customerType === 'pf' || digits?.length === 11) {
    return 'F' as const;
  }

  return undefined;
}

export function mapOrderToBlingDraft(
  order: OrderListItem,
  options: { paymentMethodId?: number } = {}
): BlingOrderDraft {
  const customerName = order.customer?.name ?? order.customerName;
  const customerDocument = onlyDigits(order.customer?.document);
  const shippingAddress = order.customer?.shippingAddress;
  const orderDate = toDateOnly(order.createdAt);
  const items = order.items.map((item) => ({
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
  }));
  const totals = {
    subtotal: toMoney(order.subtotal),
    shipping: toMoney(order.shippingTotal),
    discount: toMoney(order.discountTotal),
    total: toMoney(order.total),
  };
  const payload = {
    numeroLoja: order.orderNumber,
    data: orderDate,
    dataSaida: orderDate,
    dataPrevista: orderDate,
    contato: {
      nome: customerName,
      tipoPessoa: toBlingPersonType(order.customerType, customerDocument),
      numeroDocumento: customerDocument,
    },
    itens: items.map((item) => ({
      codigo: item.sku,
      unidade: 'UN' as const,
      quantidade: item.quantity,
      valor: toMoney(item.unitPrice),
      descricao: item.name,
    })),
    parcelas: [
      {
        dataVencimento: orderDate,
        valor: totals.total,
        formaPagamento: options.paymentMethodId
          ? { id: options.paymentMethodId }
          : undefined,
      },
    ].filter((parcela) => parcela.valor > 0),
    desconto:
      totals.discount > 0
        ? {
            valor: totals.discount,
            unidade: 'REAL' as const,
          }
        : undefined,
    transporte: shippingAddress
      ? {
          fretePorConta: totals.shipping > 0 ? (0 as const) : (9 as const),
          frete: totals.shipping,
          etiqueta: {
            nome: shippingAddress.recipientName ?? customerName,
            endereco: shippingAddress.street,
            numero: shippingAddress.number,
            complemento: shippingAddress.complement,
            municipio: shippingAddress.city,
            uf: shippingAddress.state,
            cep: onlyDigits(shippingAddress.postalCode),
            bairro: shippingAddress.district,
            nomePais: shippingAddress.country ?? 'BRASIL',
          },
        }
      : undefined,
    observacoesInternas: `Pedido Zalen Shop ${order.orderNumber}`,
  } satisfies BlingOrderDraft['payload'];

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: {
      name: customerName,
      email: order.customer?.email ?? order.customerEmail,
      phone: order.customer?.phone,
      document: customerDocument,
    },
    shippingAddress,
    items,
    totals,
    payload,
  };
}

export function summarizeBlingOrderDraft(draft: BlingOrderDraft) {
  return {
    orderId: draft.orderId,
    orderNumber: draft.orderNumber,
    customerPresent: Boolean(draft.customer.name && draft.customer.email),
    documentPresent: Boolean(draft.customer.document),
    phonePresent: Boolean(draft.customer.phone),
    addressPresent: Boolean(
      draft.shippingAddress?.postalCode ||
        draft.shippingAddress?.city ||
        draft.shippingAddress?.state
    ),
    itemCount: draft.items.length,
    total: draft.totals.total,
  };
}
