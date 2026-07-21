import 'server-only';

import type { BlingOrderDraft, BlingSalesOrderPayload } from './bling-order.types';

type BlingReferenceClient = {
  request<T>(
    path: string,
    init?: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      query?: Record<
        string,
        string | number | Array<string | number> | undefined
      >;
      body?: unknown;
    }
  ): Promise<T>;
};

type BlingContactListResponse = {
  data?: Array<{
    id?: number;
    numeroDocumento?: string;
  }>;
};

type BlingProductListResponse = {
  data?: Array<{
    id?: number;
    codigo?: string;
  }>;
};

type BlingPostResponse = {
  data?: {
    id?: number;
  };
};

function onlyDigits(value: string | undefined) {
  return value?.replace(/\D/g, '') || undefined;
}

function normalizeSku(value: string | undefined) {
  return value?.trim().toLocaleUpperCase('pt-BR') || undefined;
}

function compactRecord<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== '')
  );
}

async function resolveContactId(
  client: BlingReferenceClient,
  draft: BlingOrderDraft
) {
  const document = onlyDigits(draft.customer.document);

  if (!draft.customer.name || !document) {
    throw new Error('order_missing_customer_data');
  }

  const contacts = await client.request<BlingContactListResponse>('/contatos', {
    query: {
      numeroDocumento: document,
      criterio: 1,
      limite: 100,
    },
  });
  const existing = contacts.data?.find(
    (contact) =>
      contact.id &&
      (!contact.numeroDocumento || onlyDigits(contact.numeroDocumento) === document)
  );

  if (existing?.id) {
    return existing.id;
  }

  const address = draft.shippingAddress;
  const addressPayload = address
    ? compactRecord({
        endereco: address.street,
        cep: onlyDigits(address.postalCode),
        bairro: address.district,
        municipio: address.city,
        uf: address.state,
        numero: address.number,
        complemento: address.complement,
      })
    : undefined;
  const response = await client.request<BlingPostResponse>('/contatos', {
    method: 'POST',
    body: {
      nome: draft.customer.name,
      situacao: 'A',
      tipo: draft.payload.contato.tipoPessoa ?? 'F',
      numeroDocumento: document,
      email: draft.customer.email,
      celular: draft.customer.phone,
      endereco:
        addressPayload && Object.keys(addressPayload).length > 0
          ? { geral: addressPayload }
          : undefined,
    },
  });

  if (!response.data?.id) {
    throw new Error('bling_contact_response_missing_id');
  }

  return response.data.id;
}

async function resolveProductIdsBySku(
  client: BlingReferenceClient,
  draft: BlingOrderDraft
) {
  const skus = Array.from(
    new Set(
      draft.items
        .map((item) => item.sku?.trim())
        .filter((sku): sku is string => Boolean(sku))
    )
  );

  if (skus.length !== draft.items.length) {
    throw new Error('order_item_missing_sku');
  }

  const response = await client.request<BlingProductListResponse>('/produtos', {
    query: {
      'codigos[]': skus,
      criterio: 5,
      limite: 100,
    },
  });
  const idBySku = new Map<string, number>();

  for (const product of response.data ?? []) {
    const sku = normalizeSku(product.codigo);

    if (sku && product.id) {
      idBySku.set(sku, product.id);
    }
  }

  return draft.items.map((item) => {
    const sku = normalizeSku(item.sku);
    const id = sku ? idBySku.get(sku) : undefined;

    if (!id) {
      throw new Error('bling_product_not_found_for_sku');
    }

    return id;
  });
}

export async function resolveBlingOrderReferences(
  client: BlingReferenceClient,
  draft: BlingOrderDraft
): Promise<BlingSalesOrderPayload> {
  const contactId = await resolveContactId(client, draft);
  const productIds = await resolveProductIdsBySku(client, draft);

  return {
    ...draft.payload,
    contato: {
      ...draft.payload.contato,
      id: contactId,
    },
    itens: draft.payload.itens.map((item, index) => ({
      ...item,
      produto: {
        id: productIds[index],
      },
    })),
  };
}
