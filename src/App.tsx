'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import Navbar from './components/layout/Navbar';
import Hero from './components/home/Hero';
import BenefitsBar from './components/home/BenefitsBar';
import CategoryProductSections from './components/home/CategoryProductSections';
import FeaturedProduct from './components/home/FeaturedProduct';
import BestSellers from './components/home/BestSellers';
import TechSection from './components/home/TechSection';
import GGGroupCompanies from './components/home/GGGroupCompanies';
import ProductDetailsView from './components/product/ProductDetailsView';
import CartSidebar from './components/ecommerce/CartSidebar';
import Footer from './components/layout/Footer';
import type { Product, StorefrontCategory } from './types';
import type { Cart } from './modules/cart/cart.types';
import type { StorefrontNavigation } from './modules/catalog/storefront-navigation';
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
import { pushMarketingEvent } from './modules/marketing/marketing.client';
import { PjDiscountNotice } from './components/storefront/PjDiscountNotice';
import { WhatsAppFloatingButton } from './components/storefront/WhatsAppFloatingButton';

interface AppProps {
  products: Product[];
  categories: StorefrontCategory[];
  navigation?: StorefrontNavigation;
  businessDiscountPercentage?: number;
}

function normalizeCategoryText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function findCategorySlug(
  categories: StorefrontCategory[],
  candidates: string[]
) {
  const normalizedCandidates = candidates.map(normalizeCategoryText);

  return (
    categories.find((category) => {
      const haystack = normalizeCategoryText(`${category.name} ${category.slug}`);
      return normalizedCandidates.some((candidate) => haystack.includes(candidate));
    })?.slug ?? null
  );
}

export default function App({
  products,
  categories,
  navigation,
  businessDiscountPercentage,
}: AppProps) {
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

    pushMarketingEvent({
      event: 'add_to_cart',
      event_id: `add_to_cart:${product.catalogProductId}:${product.variantId}:${Date.now()}`,
      ecommerce: {
        currency: 'BRL',
        value: product.price * quantity,
        items: [
          {
            item_id: product.sku ?? product.variantId,
            item_name: product.name,
            item_category: product.category,
            price: product.price,
            quantity,
          },
        ],
      },
      meta: {
        eventName: 'AddToCart',
        contentIds: [product.sku ?? product.variantId],
        contentName: product.name,
      },
    });

    setCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, variantId: string, qty: number) => {
    persistCart(updateQuantity(cart, productId, variantId, qty));
  };

  const handleRemoveItem = (productId: string, variantId: string) => {
    persistCart(removeItem(cart, productId, variantId));
  };

  const handleCheckout = () => {
    pushMarketingEvent({
      event: 'begin_checkout',
      event_id: `begin_checkout:${Date.now()}`,
      ecommerce: {
        currency: 'BRL',
        value: cart.total,
        items: cart.items.map((item) => ({
          item_id: item.sku ?? item.variantId,
          item_name: item.name,
          price: item.unitPrice,
          quantity: item.quantity,
        })),
      },
      meta: {
        eventName: 'InitiateCheckout',
        contentIds: cart.items.map((item) => item.sku ?? item.variantId),
      },
    });
    setCartOpen(false);
    window.location.href = '/carrinho';
  };

  const handleCategoryFromNavbar = (cat: string | null) => {
    setActiveCategory(cat);
    setSearchQuery('');
    if (currentPage !== 'home') {
      setCurrentPage('home');
    }
  };

  const handleExploreSection = (input: {
    categorySlug?: string;
    searchQuery?: string;
  }) => {
    setActiveCategory(input.categorySlug ?? null);
    setSearchQuery(input.searchQuery ?? '');
    if (currentPage !== 'home') {
      setCurrentPage('home');
    }
    window.setTimeout(() => {
      const section = document.getElementById('catalogo');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
  };
  const shouldShowCatalog = Boolean(activeCategory || searchQuery.trim());

  return (
    <div className="min-h-screen bg-brand-bg md:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-deep/30 via-brand-bg to-brand-bg relative" style={{ maxWidth: '100vw' }}>
      <div className="absolute top-[5%] left-[20%] w-[600px] h-[600px] rounded-full glow-radial pointer-events-none -translate-x-1/2 -z-30"></div>
      <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full glow-radial-green pointer-events-none -z-30"></div>

      <Navbar
        categories={categories}
        navigation={navigation}
        productPreviews={products.map((product) => ({
          id: product.id,
          name: product.name,
          href: `/produto/${product.id}`,
          imageUrl: product.image,
          price: product.price,
          searchText: [
            product.sku,
            product.category,
            ...(product.categories?.map((category) => category.name) ?? []),
          ].filter(Boolean).join(' '),
        }))}
        cartItemsCount={cartItemsCount}
        onCartToggle={() => setCartOpen(!cartOpen)}
        activeCategory={activeCategory}
        onCategorySelect={handleCategoryFromNavbar}
        onNavigateToHome={handleBackToHome}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
      />

      <WhatsAppFloatingButton />

      {businessDiscountPercentage ? (
        <div className="relative z-20 mx-auto max-w-7xl px-4 pt-28 md:px-8">
          <PjDiscountNotice percentage={businessDiscountPercentage} />
        </div>
      ) : null}

      {currentPage === 'home' ? (
        <main className="w-full">
          <Hero
            onExploreClick={() => {
              const sec = document.getElementById('vitrines');
              if (sec) sec.scrollIntoView({ behavior: 'smooth' });
            }}
            onPeasClick={() => {
              setActiveCategory(
                findCategorySlug(categories, ['peca', 'pecas', 'componente'])
              );
              const sec = document.getElementById('catalogo');
              if (sec) sec.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          <BenefitsBar />

          <CategoryProductSections
            products={products}
            categories={categories}
            onProductClick={handleProductSelect}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
            onExploreSection={handleExploreSection}
          />

          <FeaturedProduct
            onProductClick={handleProductSelect}
            onAddToCart={(id) => {
              const prodSelect = products.find((p) => p.id === id);
              if (prodSelect) handleAddToCart(prodSelect, 1);
            }}
          />

          {shouldShowCatalog ? (
            <BestSellers
              products={products}
              categories={categories}
              onProductClick={handleProductSelect}
              onAddToCart={(prod) => handleAddToCart(prod, 1)}
              activeCategory={activeCategory}
              onCategorySelect={(category) => {
                setActiveCategory(category);
                if (category) {
                  setSearchQuery('');
                }
              }}
              searchQuery={searchQuery}
            />
          ) : (
            <div id="catalogo" className="scroll-mt-28" />
          )}

          <TechSection />
          <GGGroupCompanies />
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

      <Footer categories={categories} />

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
