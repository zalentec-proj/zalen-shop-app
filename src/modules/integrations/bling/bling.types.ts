/**
 * Tipos do conector Bling.
 * Contratos para a integração futura — sem implementação real ainda.
 */

export interface BlingProduct {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
  situacao: 'A' | 'I';
}

export interface BlingOrder {
  id: number;
  numero: string;
  situacao: string;
  total: number;
}

export interface BlingWebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

export interface BlingConnectionConfig {
  storeId: string;
  /** Nunca expor no frontend */
  accessToken?: never;
  /** Nunca expor no frontend */
  refreshToken?: never;
}
