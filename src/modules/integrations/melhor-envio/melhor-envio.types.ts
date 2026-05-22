/**
 * Tipos do conector Melhor Envio.
 * Contratos para a integração futura — sem implementação real ainda.
 */

export interface ShippingQuoteInput {
  fromPostalCode: string;
  toPostalCode: string;
  weight: number;
  width: number;
  height: number;
  depth: number;
}

export interface ShippingOption {
  carrierId: number;
  carrierName: string;
  serviceName: string;
  price: number;
  deliveryDays: number;
}
