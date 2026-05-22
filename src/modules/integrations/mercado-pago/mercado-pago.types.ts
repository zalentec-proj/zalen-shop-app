/**
 * Tipos do conector Mercado Pago.
 * Contratos para a integração futura — sem implementação real ainda.
 */

export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export interface PaymentIntent {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  /** Nunca expor access_token no frontend */
}

export interface PaymentResult {
  externalId: string;
  status: 'pending' | 'approved' | 'rejected';
  pixQrCode?: string;
  boletoUrl?: string;
}
