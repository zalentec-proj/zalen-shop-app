'use client';

import { useEffect } from 'react';
import { clearStoredCart } from '@/modules/cart/cart.storage';

export function ClearCartOnApproved() {
  useEffect(() => {
    clearStoredCart();
  }, []);

  return null;
}
