'use client';

import type { Cart, CartItem } from './cart.types';
import { addItem, createEmptyCart } from './cart.utils';

const CART_STORAGE_KEY = 'zalen-shop:cart:v1';
const CART_UPDATED_EVENT = 'zalen-shop:cart-updated';

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<CartItem>;
  return (
    typeof item.productId === 'string' &&
    typeof item.variantId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.unitPrice === 'number' &&
    Number.isFinite(item.unitPrice) &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
}

function recalculateCart(items: CartItem[]): Cart {
  return items.reduce((cart, item) => addItem(cart, item), createEmptyCart());
}

function notifyCartUpdated() {
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function getStoredCart(): Cart {
  if (typeof window === 'undefined') {
    return createEmptyCart();
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!raw) {
      return createEmptyCart();
    }

    const parsed = JSON.parse(raw) as Partial<Cart>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(isCartItem)
      : [];

    return recalculateCart(items);
  } catch {
    return createEmptyCart();
  }
}

export function saveStoredCart(cart: Cart): Cart {
  if (typeof window === 'undefined') {
    return cart;
  }

  const sanitizedCart = recalculateCart(cart.items.filter(isCartItem));
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sanitizedCart));
  notifyCartUpdated();
  return sanitizedCart;
}

export function addStoredCartItem(item: CartItem): Cart {
  const nextCart = addItem(getStoredCart(), item);
  return saveStoredCart(nextCart);
}

export function clearStoredCart() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(CART_STORAGE_KEY);
  notifyCartUpdated();
}

export function subscribeToStoredCart(listener: () => void) {
  window.addEventListener(CART_UPDATED_EVENT, listener);
  window.addEventListener('storage', listener);

  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
