/**
 * Funções puras do carrinho.
 * Sem efeitos colaterais, sem chamadas externas.
 * O total aqui é apenas para exibição — o backend recalcula no checkout.
 */

import { Cart, CartItem } from './cart.types';

export function createEmptyCart(): Cart {
  return { items: [], subtotal: 0, total: 0 };
}

export function addItem(cart: Cart, item: CartItem): Cart {
  const existing = cart.items.find(
    (i) => i.productId === item.productId && i.variantId === item.variantId
  );

  const updatedItems = existing
    ? cart.items.map((i) =>
        i.productId === item.productId && i.variantId === item.variantId
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
      )
    : [...cart.items, item];

  return recalculate({ ...cart, items: updatedItems });
}

export function removeItem(
  cart: Cart,
  productId: string,
  variantId: string
): Cart {
  const updatedItems = cart.items.filter(
    (i) => !(i.productId === productId && i.variantId === variantId)
  );
  return recalculate({ ...cart, items: updatedItems });
}

export function updateQuantity(
  cart: Cart,
  productId: string,
  variantId: string,
  quantity: number
): Cart {
  if (quantity <= 0) return removeItem(cart, productId, variantId);

  const updatedItems = cart.items.map((i) =>
    i.productId === productId && i.variantId === variantId
      ? { ...i, quantity }
      : i
  );
  return recalculate({ ...cart, items: updatedItems });
}

export function clearCart(cart: Cart): Cart {
  return createEmptyCart();
}

export function getItemCount(cart: Cart): number {
  return cart.items.reduce((acc, i) => acc + i.quantity, 0);
}

/** Recalcula subtotal e total (sem frete/desconto por enquanto) */
function recalculate(cart: Cart): Cart {
  const subtotal = cart.items.reduce(
    (acc, i) => acc + i.unitPrice * i.quantity,
    0
  );
  return { ...cart, subtotal, total: subtotal };
}
