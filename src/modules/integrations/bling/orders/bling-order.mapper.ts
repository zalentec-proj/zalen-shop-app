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

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function metadataPackage(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.package;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const pack = value as Record<string, unknown>;

  return {
    weight: typeof pack.weight === 'number' ? pack.weight : undefined,
    height: typeof pack.height === 'number' ? pack.height : undefined,
    width: typeof pack.width === 'number' ? pack.width : undefined,
    length: typeof pack.length === 'number' ? pack.length : undefined,
  };
}

function formatShippingNotes(order: OrderListItem, shippingTotal: number) {
  const lines = [`Pedido Zalen Shop ${order.orderNumber}`];

  if (order.shippingProviderKey === 'superfrete') {
    lines.push('Frete cotado no checkout via SuperFrete quote-only.');
    lines.push('Etiqueta deve ser gerada operacionalmente no Bling/SuperFrete.');
  }

  if (order.shippingCarrierName) {
    lines.push(`Transportadora: ${order.shippingCarrierName}`);
  }

  if (order.shippingServiceName) {
    lines.push(`Servico: ${order.shippingServiceName}`);
  }

  if (order.shippingServiceCode) {
    lines.push(`Codigo do servico: ${order.shippingServiceCode}`);
  }

  const deliveryLabel = metadataString(order.shippingMetadata, 'deliveryTimeLabel');

  if (deliveryLabel) {
    lines.push(`Prazo exibido ao cliente: ${deliveryLabel}`);
  }

  lines.push(`Valor cobrado: R$ ${toMoney(shippingTotal).toFixed(2)}`);

  const pack = metadataPackage(order.shippingMetadata);

  if (pack?.length && pack.width && pack.height && pack.weight) {
    lines.push(
      `Pacote calculado: ${pack.length}x${pack.width}x${pack.height} cm, ${pack.weight} kg.`
    );
  }

  return lines.join('\n');
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
    observacoesInternas: formatShippingNotes(order, totals.shipping),
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
