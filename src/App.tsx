'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import Navbar from './components/layout/Navbar';
import Hero from './components/home/Hero';
import BenefitsBar from './components/home/BenefitsBar';
import Categories from './components/home/Categories';
import FeaturedProduct from './components/home/FeaturedProduct';
import BestSellers from './components/home/BestSellers';
import TechSection from './components/home/TechSection';
import ProductDetailsView from './components/product/ProductDetailsView';
import CartSidebar from './components/ecommerce/CartSidebar';
import Footer from './components/layout/Footer';
import type { Product } from './types';
import type { Cart } from './modules/cart/cart.types';
import {
  addItem,
  createEmptyCart,
  getItemCount,
  removeItem,
  updateQuantity,
} from './modules/cart/cart.utils';
import {
  getStoredCart,
  saveStoredCart,
  subscribeToStoredCart,
} from './modules/cart/cart.storage';

interface AppProps {
  products: Product[];
}

export default function App({ products }: AppProps) {
  const [currentPage, setCurrentPage] = useState<'home' | 'product_detail'>('home');
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id ?? 'dji-mavic-3-pro'
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<Cart>(() => createEmptyCart());

  useEffect(() => {
    setCart(getStoredCart());
    return subscribeToStoredCart(() => setCart(getStoredCart()));
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  const cartItemsCount = useMemo(() => {
    return getItemCount(cart);
  }, [cart]);

  const persistCart = (nextCart: Cart) => {
    setCart(saveStoredCart(nextCart));
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentPage('product_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    if (!product.catalogProductId || !product.variantId) {
      return;
    }

    persistCart(addItem(cart, {
      productId: product.catalogProductId,
      variantId: product.variantId,
      sku: product.sku,
      name: product.name,
      imageUrl: product.image,
      unitPrice: product.price,
      quantity,
    }));

    setCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, variantId: string, qty: number) => {
    persistCart(updateQuantity(cart, productId, variantId, qty));
  };

  const handleRemoveItem = (productId: string, variantId: string) => {
    persistCart(removeItem(cart, productId, variantId));
  };

  const handleCheckout = () => {
    setCartOpen(false);
    window.location.href = '/carrinho';
  };

  const handleCategoryFromNavbar = (cat: string | null) => {
    setActiveCategory(cat);
    if (currentPage !== 'home') {
      setCurrentPage('home');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg md:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-deep/30 via-brand-bg to-brand-bg relative" style={{ maxWidth: '100vw' }}>
      <div className="absolute top-[5%] left-[20%] w-[600px] h-[600px] rounded-full glow-radial pointer-events-none -translate-x-1/2 -z-30"></div>
      <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full glow-radial-green pointer-events-none -z-30"></div>

      <Navbar
        cartItemsCount={cartItemsCount}
        onCartToggle={() => setCartOpen(!cartOpen)}
        activeCategory={activeCategory}
        onCategorySelect={handleCategoryFromNavbar}
        onNavigateToHome={handleBackToHome}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
      />

      {currentPage === 'home' ? (
        <main className="w-full">
          <Hero
            onExploreClick={() => {
              const sec = document.getElementById('catalogo');
              if (sec) sec.scrollIntoView({ behavior: 'smooth' });
            }}
            onPeasClick={() => {
              setActiveCategory('Peças');
              const sec = document.getElementById('catalogo');
              if (sec) sec.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          <BenefitsBar />

          <Categories
            activeCategory={activeCategory}
            onCategorySelect={setActiveCategory}
          />

          <FeaturedProduct
            onProductClick={handleProductSelect}
            onAddToCart={(id) => {
              const prodSelect = products.find((p) => p.id === id);
              if (prodSelect) handleAddToCart(prodSelect, 1);
            }}
          />

          <BestSellers
            products={products}
            onProductClick={handleProductSelect}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
            activeCategory={activeCategory}
            onCategorySelect={setActiveCategory}
            searchQuery={searchQuery}
          />

          <TechSection />
        </main>
      ) : (
        <main className="w-full">
          {selectedProduct ? (
            <ProductDetailsView
              product={selectedProduct}
              onBackToHome={handleBackToHome}
              onAddToCart={handleAddToCart}
            />
          ) : null}
        </main>
      )}

      <Footer />

      <CartSidebar
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
