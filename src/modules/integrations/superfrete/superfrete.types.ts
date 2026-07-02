export interface SuperFreteQuoteProduct {
  quantity: number;
  height: number;
  width: number;
  length: number;
  weight: number;
}

export interface SuperFreteQuoteRequest {
  from: {
    postal_code: string;
  };
  to: {
    postal_code: string;
  };
  services: string;
  options: {
    own_hand: false;
    receipt: false;
    insurance_value: number;
    use_insurance_value: boolean;
  };
  products: SuperFreteQuoteProduct[];
}

export interface SuperFreteQuotePackage {
  price?: number | string;
  discount?: number | string;
  format?: string;
  dimensions?: {
    height?: number | string;
    width?: number | string;
    length?: number | string;
  };
  weight?: number | string;
  insurance_value?: number | string;
}

export interface SuperFreteQuoteResponseItem {
  id?: number | string;
  name?: string;
  price?: number | string;
  discount?: number | string;
  currency?: string;
  delivery_time?: number;
  delivery_range?: {
    min?: number;
    max?: number;
  };
  packages?: SuperFreteQuotePackage[];
  additional_services?: {
    receipt?: boolean;
    own_hand?: boolean;
  };
  company?: {
    id?: number | string;
    name?: string;
    picture?: string;
  };
  has_error?: boolean;
  error?: string;
}

export type SuperFreteQuoteResponse = SuperFreteQuoteResponseItem[];
