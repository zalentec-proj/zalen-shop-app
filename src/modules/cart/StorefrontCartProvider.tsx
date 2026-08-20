'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import CartSidebar from '@/components/ecommerce/CartSidebar';
import { pushMarketingEvent } from '@/modules/marketing/marketing.client';
import type { Cart, CartItem } from './cart.types';
import {
  addStoredCartItem,
  getStoredCart,
  saveStoredCart,
  subscribeToStoredCart,
} from './cart.storage';
import {
  createEmptyCart,
  removeItem,
  updateQuantity,
} from './cart.utils';

type AddCartItemOptions = {
  openCart?: boolean;
};

type StorefrontCartContextValue = {
  cart: Cart;
  isCartOpen: boolean;
  addCartItem: (item: CartItem, options?: AddCartItemOptions) => Cart;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  updateCartItemQuantity: (
    productId: string,
    variantId: string,
    quantity: number
  ) => void;
  removeCartItem: (productId: string, variantId: string) => void;
  goToCheckout: (cartOverride?: Cart) => void;
};

const StorefrontCartContext = createContext<StorefrontCartContextValue | null>(
  null
);

export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>(() => createEmptyCart());
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const syncCart = () => setCart(getStoredCart());
    syncCart();
    return subscribeToStoredCart(syncCart);
  }, []);

  const persistCart = useCallback((nextCart: Cart) => {
    setCart(saveStoredCart(nextCart));
  }, []);

  const addCartItem = useCallback(
    (item: CartItem, options: AddCartItemOptions = {}) => {
      const nextCart = addStoredCartItem(item);
      setCart(nextCart);

      if (options.openCart !== false) {
        setIsCartOpen(true);
      }

      return nextCart;
    },
    []
  );

  const updateCartItemQuantity = useCallback(
    (productId: string, variantId: string, quantity: number) => {
      persistCart(updateQuantity(getStoredCart(), productId, variantId, quantity));
    },
    [persistCart]
  );

  const removeCartItem = useCallback(
    (productId: string, variantId: string) => {
      persistCart(removeItem(getStoredCart(), productId, variantId));
    },
    [persistCart]
  );

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(
    () => setIsCartOpen((current) => !current),
    []
  );

  const goToCheckout = useCallback(
    (cartOverride?: Cart) => {
      const checkoutCart = cartOverride ?? getStoredCart();

      if (checkoutCart.items.length === 0) {
        setIsCartOpen(true);
        return;
      }

      pushMarketingEvent({
        event: 'begin_checkout',
        event_id: `begin_checkout:${Date.now()}`,
        ecommerce: {
          currency: 'BRL',
          value: checkoutCart.total,
          items: checkoutCart.items.map((item) => ({
            item_id: item.sku ?? item.variantId,
            item_name: item.name,
            price: item.unitPrice,
            quantity: item.quantity,
          })),
        },
        meta: {
          eventName: 'InitiateCheckout',
          contentIds: checkoutCart.items.map(
            (item) => item.sku ?? item.variantId
          ),
        },
      });
      setIsCartOpen(false);
      router.push('/carrinho');
    },
    [router]
  );

  const value = useMemo<StorefrontCartContextValue>(
    () => ({
      cart,
      isCartOpen,
      addCartItem,
      openCart,
      closeCart,
      toggleCart,
      updateCartItemQuantity,
      removeCartItem,
      goToCheckout,
    }),
    [
      addCartItem,
      cart,
      closeCart,
      goToCheckout,
      isCartOpen,
      openCart,
      removeCartItem,
      toggleCart,
      updateCartItemQuantity,
    ]
  );

  return (
    <StorefrontCartContext.Provider value={value}>
      {children}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={closeCart}
        cart={cart}
        onUpdateQuantity={updateCartItemQuantity}
        onRemoveItem={removeCartItem}
        onCheckout={() => goToCheckout()}
      />
    </StorefrontCartContext.Provider>
  );
}

export function useStorefrontCart() {
  const context = useContext(StorefrontCartContext);

  if (!context) {
    throw new Error(
      'useStorefrontCart must be used within StorefrontCartProvider'
    );
  }

  return context;
}
