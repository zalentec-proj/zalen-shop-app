'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import Navbar from './components/layout/Navbar';
import Hero from './components/home/Hero';
import BenefitsBar from './components/home/BenefitsBar';
import CategoryProductSections from './components/home/CategoryProductSections';
import BestSellers from './components/home/BestSellers';
import TechSection from './components/home/TechSection';
import GGGroupCompanies from './components/home/GGGroupCompanies';
import ProductDetailsView from './components/product/ProductDetailsView';
import Footer from './components/layout/Footer';
import type { Product, StorefrontCategory } from './types';
import type { StorefrontNavigation } from './modules/catalog/storefront-navigation';
import { getItemCount } from './modules/cart/cart.utils';
import { useStorefrontCart } from './modules/cart/StorefrontCartProvider';
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
  const {
    cart,
    addCartItem,
    toggleCart,
    goToCheckout,
  } = useStorefrontCart();

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  const cartItemsCount = getItemCount(cart);

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentPage('product_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (
    product: Product,
    quantity: number = 1,
    options: { checkoutNow?: boolean } = {}
  ) => {
    if (!product.isAvailable || !product.catalogProductId || !product.variantId) {
      return;
    }

    const nextCart = addCartItem({
      productId: product.catalogProductId,
      variantId: product.variantId,
      sku: product.sku,
      name: product.name,
      imageUrl: product.image,
      unitPrice: product.price,
      quantity,
    }, { openCart: !options.checkoutNow });

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

    if (options.checkoutNow) {
      goToCheckout(nextCart);
    }
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
    <div className="relative min-h-screen max-w-[100vw] overflow-x-hidden bg-brand-bg from-blue-deep/30 via-brand-bg to-brand-bg md:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]">
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
        onCartToggle={toggleCart}
        activeCategory={activeCategory}
        onCategorySelect={handleCategoryFromNavbar}
        onNavigateToHome={handleBackToHome}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
      />

      <WhatsAppFloatingButton />

      {businessDiscountPercentage ? (
        <div className="relative z-20 mx-auto max-w-7xl px-4 pt-24 md:px-8 md:pt-28 xl:pt-40">
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
              onBuyNow={(product, quantity) =>
                handleAddToCart(product, quantity, { checkoutNow: true })
              }
            />
          ) : null}
        </main>
      )}

      <Footer categories={categories} />

    </div>
  );
}
