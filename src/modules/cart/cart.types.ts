/**
 * Tipos do módulo de carrinho.
 * O carrinho é client-side. Preço e estoque são validados no servidor no checkout.
 */

export interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  sku?: string;
  imageUrl?: string;
  /** Preço exibido — NÃO é fonte de verdade para cobrança */
  unitPrice: number;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  /** Subtotal calculado localmente — apenas para exibição */
  subtotal: number;
  /** Total calculado localmente — apenas para exibição */
  total: number;
}
