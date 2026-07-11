import type { MercadoPagoBrickPaymentFormData } from './mercado-pago.types';

export type MercadoPagoBrickPaymentKind = 'card' | 'pix' | 'ticket';

export class MercadoPagoPaymentPayloadError extends Error {
  constructor(
    readonly code:
      | 'unsupported_payment_method'
      | 'card_token_missing'
      | 'ticket_payer_address_missing'
  ) {
    super(code);
    this.name = 'MercadoPagoPaymentPayloadError';
  }
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toPositiveInteger(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function splitName(fullName: string | undefined) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const name = parts.shift();
  const surname = parts.join(' ');

  return { name, surname: surname || undefined };
}

function getDocumentType(document: string | undefined) {
  const digits = document?.replace(/\D/g, '') ?? '';
  return digits.length === 14 ? 'CNPJ' : digits.length === 11 ? 'CPF' : undefined;
}

function getRecordString(
  formData: MercadoPagoBrickPaymentFormData,
  key: string
) {
  return toOptionalString((formData as Record<string, unknown>)[key]);
}

function getPaymentKind(
  formData: MercadoPagoBrickPaymentFormData
): MercadoPagoBrickPaymentKind | undefined {
  const method = toOptionalString(formData.payment_method_id)?.toLowerCase();
  const type = toOptionalString(formData.payment_type_id)?.toLowerCase();

  if (method === 'pix' || type === 'bank_transfer') return 'pix';
  if (type === 'ticket' || method?.startsWith('bol')) return 'ticket';

  const hasCardInstallments =
    formData.installments !== undefined && formData.installments !== null;
  const cardByType = type === 'credit_card' || type === 'debit_card';
  const cardByToken = Boolean(toOptionalString(formData.token));
  const cardByInstallments = Boolean(
    hasCardInstallments &&
      method &&
      !['pix', 'bolbradesco', 'pec', 'pagofacil', 'rapipago'].includes(method)
  );

  return cardByType || cardByToken || cardByInstallments ? 'card' : undefined;
}

function getCardholderName(formData: MercadoPagoBrickPaymentFormData) {
  const payer = formData.payer ?? {};
  const firstName =
    toOptionalString(payer.first_name) ??
    getRecordString(formData, 'cardholderName') ??
    getRecordString(formData, 'card_holder_name');
  const lastName = toOptionalString(payer.last_name);

  if (firstName || lastName) {
    return { name: firstName, surname: lastName };
  }

  return splitName(
    getRecordString(formData, 'cardholder_name') ??
      getRecordString(formData, 'cardHolderName')
  );
}

function getPayerIdentification(
  payer: MercadoPagoBrickPaymentFormData['payer']
) {
  const type = toOptionalString(payer?.identification?.type);
  const number = toOptionalString(payer?.identification?.number)?.replace(/\D/g, '');

  return type && number ? { type, number } : undefined;
}

function getTicketPayerAddress(input: {
  customer?: {
    shippingAddress?: {
      postalCode?: string;
      street?: string;
      number?: string;
      district?: string;
      city?: string;
      state?: string;
    };
  };
}) {
  const address = input.customer?.shippingAddress;
  const zipCode = address?.postalCode?.replace(/\D/g, '');
  const streetName = toOptionalString(address?.street);
  const streetNumber = toOptionalString(address?.number);
  const neighborhood = toOptionalString(address?.district);
  const city = toOptionalString(address?.city);
  const federalUnit = toOptionalString(address?.state)?.toUpperCase();

  if (
    !zipCode ||
    zipCode.length !== 8 ||
    !streetName ||
    !streetNumber ||
    !neighborhood ||
    !city ||
    !federalUnit
  ) {
    return undefined;
  }

  return {
    zip_code: zipCode,
    street_name: streetName,
    street_number: streetNumber,
    neighborhood,
    city,
    federal_unit: federalUnit,
  };
}

export function buildMercadoPagoBrickPaymentPayload(input: {
  order: {
    id: string;
    storeId: string;
    orderNumber: string;
    total: number;
    customer?: {
      name?: string;
      document?: string;
      shippingAddress?: {
        postalCode?: string;
        street?: string;
        number?: string;
        district?: string;
        city?: string;
        state?: string;
      };
    };
  };
  formData: MercadoPagoBrickPaymentFormData;
  payerEmail: string;
  notificationUrl?: string;
  environment: 'test' | 'production';
}) {
  const paymentMethodId = toOptionalString(input.formData.payment_method_id);
  const paymentKind = getPaymentKind(input.formData);

  if (!paymentMethodId || !paymentKind) {
    throw new MercadoPagoPaymentPayloadError('unsupported_payment_method');
  }

  const documentType = getDocumentType(input.order.customer?.document);
  const documentNumber = input.order.customer?.document?.replace(/\D/g, '');
  const payerName = splitName(input.order.customer?.name);
  const formPayer = input.formData.payer ?? {};
  const cardholderName = getCardholderName(input.formData);
  const formPayerIdentification = getPayerIdentification(formPayer);
  const customerIdentification =
    documentType && documentNumber
      ? { type: documentType, number: documentNumber }
      : undefined;
  const identification =
    paymentKind === 'card'
      ? formPayerIdentification ??
        (input.environment === 'production'
          ? customerIdentification
          : undefined)
      : customerIdentification ?? formPayerIdentification;
  const ticketPayerAddress =
    paymentKind === 'ticket' ? getTicketPayerAddress(input.order) : undefined;

  if (paymentKind === 'ticket' && !ticketPayerAddress) {
    throw new MercadoPagoPaymentPayloadError('ticket_payer_address_missing');
  }

  const payer = {
    email: input.payerEmail,
    first_name:
      paymentKind === 'card'
        ? cardholderName.name ?? payerName.name
        : payerName.name ?? formPayer.first_name,
    last_name:
      paymentKind === 'card'
        ? cardholderName.surname ?? payerName.surname
        : payerName.surname ?? formPayer.last_name,
    identification,
    ...(ticketPayerAddress ? { address: ticketPayerAddress } : {}),
  };

  const body: Record<string, unknown> = {
    transaction_amount: input.order.total,
    description: `Pedido ${input.order.orderNumber}`,
    payment_method_id: paymentMethodId,
    external_reference: input.order.id,
    notification_url: input.notificationUrl,
    metadata: {
      store_id: input.order.storeId,
      order_id: input.order.id,
      order_number: input.order.orderNumber,
      environment: input.environment,
      checkout_mode: 'payment_brick',
    },
    payer,
  };

  if (paymentKind === 'card') {
    const token = toOptionalString(input.formData.token);

    if (!token) {
      throw new MercadoPagoPaymentPayloadError('card_token_missing');
    }

    body.token = token;
    body.installments = toPositiveInteger(input.formData.installments) ?? 1;
    const issuerId =
      typeof input.formData.issuer_id === 'number'
        ? input.formData.issuer_id
        : toOptionalString(input.formData.issuer_id);

    if (issuerId !== undefined) body.issuer_id = issuerId;
  }

  return { body, paymentKind, paymentMethodId };
}
