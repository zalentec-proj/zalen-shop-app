export type BlingOrderSendStatus = 'success' | 'error' | 'skipped';

export interface BlingOrderDraftItem {
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BlingSalesOrderPayload {
  numeroLoja: string;
  data: string;
  dataSaida: string;
  dataPrevista: string;
  contato: {
    nome?: string;
    tipoPessoa?: 'F' | 'J' | 'E';
    numeroDocumento?: string;
  };
  itens: Array<{
    codigo?: string;
    unidade: 'UN';
    quantidade: number;
    valor: number;
    descricao: string;
  }>;
  parcelas: Array<{
    dataVencimento: string;
    valor: number;
    formaPagamento?: {
      id: number;
    };
  }>;
  desconto?: {
    valor: number;
    unidade: 'REAL';
  };
  transporte?: {
    fretePorConta: 0 | 1 | 2 | 3 | 4 | 9;
    frete?: number;
    etiqueta?: {
      nome?: string;
      endereco?: string;
      numero?: string;
      complemento?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
      bairro?: string;
      nomePais?: string;
    };
  };
  observacoesInternas?: string;
}

export interface BlingOrderDraft {
  orderId: string;
  orderNumber: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    document?: string;
  };
  shippingAddress?: {
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  items: BlingOrderDraftItem[];
  totals: {
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
  };
  payload: BlingSalesOrderPayload;
}

export interface BlingOrderSendResult {
  status: BlingOrderSendStatus;
  orderId: string;
  orderNumber?: string;
  externalId?: string;
  errorCode?: string;
  tokenRefreshed?: boolean;
}

export interface BlingCreateSalesOrderResponse {
  data?: {
    id?: number | string;
    alertas?: unknown[];
    rastreamento?: unknown;
  };
}
