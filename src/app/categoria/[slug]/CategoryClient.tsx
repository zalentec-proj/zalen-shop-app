'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Star,
  SlidersHorizontal,
  ArrowUpRight,
} from 'lucide-react';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { SafeCatalogImage } from '@/components/ui/SafeCatalogImage';
import { getItemCount } from '@/modules/cart/cart.utils';
import {
  getStoredCart,
  subscribeToStoredCart,
} from '@/modules/cart/cart.storage';
import type { Category, Product } from '@/modules/catalog/product.types';
import type { StorefrontNavigation } from '@/modules/catalog/storefront-navigation';
import type { StorefrontCategory } from '@/types';

interface Props {
  category: Category;
  products: Product[];
  storefrontCategories: StorefrontCategory[];
  navigation: StorefrontNavigation;
}

export default function CategoryClient({
  category,
  products,
  storefrontCategories,
  navigation,
}: Props) {
  const [sortBy, setSortBy] = useState<'relevance' | 'price-asc' | 'price-desc'>('relevance');
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setCartItemsCount(getItemCount(getStoredCart()));
    return subscribeToStoredCart(() => {
      setCartItemsCount(getItemCount(getStoredCart()));
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      return `${product.name} ${product.brand ?? ''} ${product.variants[0]?.sku ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [products, searchQuery]);

  const sorted = [...filteredProducts].sort((a, b) => {
    const pa = a.variants[0]?.price ?? 0;
    const pb = b.variants[0]?.price ?? 0;
    if (sortBy === 'price-asc') return pa - pb;
    if (sortBy === 'price-desc') return pb - pa;
    return 0;
  });

  return (
    <div className="min-h-screen bg-brand-bg relative">
      <div className="absolute top-[5%] left-[15%] w-[500px] h-[500px] rounded-full glow-radial pointer-events-none -z-10 opacity-30" />

      <Navbar
        categories={storefrontCategories}
        navigation={navigation}
        cartItemsCount={cartItemsCount}
        onCartToggle={() => {
          window.location.href = '/carrinho';
        }}
        activeCategory={category.slug}
        onCategorySelect={() => undefined}
        onNavigateToHome={() => {
          window.location.href = '/';
        }}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
      />

      <main className="mx-auto max-w-7xl px-3 pb-14 pt-24 md:px-8 md:pt-44 lg:pt-48">
        {/* Header */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-xs text-brand-muted uppercase tracking-widest mb-1">Categoria</p>
            <h1 className="text-3xl md:text-4xl font-black text-white font-display">{category.name}</h1>
            <p className="text-sm text-brand-muted mt-2">
              {sorted.length} {sorted.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
            </p>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 glass-panel-soft rounded-xl px-4 py-2">
            <SlidersHorizontal className="w-4 h-4 text-brand-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="cursor-pointer bg-transparent text-sm text-brand-white outline-none [color-scheme:dark]"
            >
              <option value="relevance" className="bg-[#0B1018] text-white">Relevância</option>
              <option value="price-asc" className="bg-[#0B1018] text-white">Menor preço</option>
              <option value="price-desc" className="bg-[#0B1018] text-white">Maior preço</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-brand-muted text-lg">Nenhum produto nesta categoria ainda.</p>
            <Link href="/" className="text-blue-primary text-sm hover:underline">Ver todos os produtos</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((product) => {
              const variant = product.variants[0];
              const price = variant?.price ?? 0;
              const monthly = (price / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              return (
                <Link
                  key={product.id}
                  href={`/produto/${product.slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl glass-panel transition-all duration-500 hover:-translate-y-2 hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.55)] md:rounded-[24px]"
                >
                  {/* Image */}
                  <div className="relative flex h-32 w-full items-center justify-center overflow-hidden border-b border-brand-border-soft bg-gradient-to-b from-white/[0.04] via-transparent to-transparent p-2 sm:h-44 sm:p-3 md:h-52 md:p-4">
                    {product.isNew && (
                      <span className="absolute top-3 left-3 z-10 bg-blue-primary/10 border border-blue-primary/40 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-blue-primary uppercase tracking-wider">
                        Novo
                      </span>
                    )}
                    <SafeCatalogImage
                      src={product.images[0]?.url}
                      alt={product.images[0]?.alt ?? product.name}
                      className="h-full w-full select-none object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-all duration-500 group-hover:scale-105"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-2 p-3 sm:gap-3 sm:p-4 md:p-5">
                    <div>
                      <span className="hidden text-[10px] font-bold uppercase tracking-widest text-brand-muted sm:block">{product.brand}</span>
                      <h3 className="mt-0.5 min-h-8 line-clamp-2 text-[12px] font-bold leading-4 tracking-tight text-white transition-colors group-hover:text-blue-primary sm:min-h-0 sm:text-[15px] sm:leading-5">
                        {product.name}
                      </h3>
                    </div>

                    {product.rating && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < Math.round(product.rating!) ? 'text-yellow-500 fill-yellow-500' : 'text-brand-border'}`} />
                          ))}
                        </div>
                        <span className="text-[11px] text-brand-muted">({product.reviewsCount})</span>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] text-brand-muted sm:text-[11px]">12x de R$ {monthly}</span>
                      <p className="text-base font-extrabold text-green-accent sm:text-lg">
                        R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-brand-border-soft pt-2">
                      <span className="text-[11px] font-semibold text-brand-white transition-colors group-hover:text-blue-primary sm:text-xs">
                        Ver detalhes
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-primary/20 bg-blue-primary/10 text-blue-primary transition-all group-hover:bg-blue-primary group-hover:text-white sm:h-9 sm:w-9 sm:rounded-xl">
                          <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-brand-muted group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer categories={storefrontCategories} />
    </div>
  );
}
