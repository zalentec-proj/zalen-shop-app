'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { getItemCount } from '@/modules/cart/cart.utils';
import { getStoredCart, subscribeToStoredCart } from '@/modules/cart/cart.storage';
import type { Product } from '@/modules/catalog/product.types';
import type { StorefrontNavigation } from '@/modules/catalog/storefront-navigation';
import type { StorefrontCategory } from '@/types';

type SortBy = 'relevance' | 'price-asc' | 'price-desc';

interface ModelListingClientProps {
  eyebrow: string;
  title: string;
  products: Product[];
  storefrontCategories: StorefrontCategory[];
  navigation: StorefrontNavigation;
}

function productPrice(product: Product) {
  const variant = product.variants[0];
  return variant?.promotionalPrice ?? variant?.price ?? 0;
}

export default function ModelListingClient({
  eyebrow,
  title,
  products,
  storefrontCategories,
  navigation,
}: ModelListingClientProps) {
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    setCartItemsCount(getItemCount(getStoredCart()));
    return subscribeToStoredCart(() => {
      setCartItemsCount(getItemCount(getStoredCart()));
    });
  }, []);

  const technicalCategories = useMemo(() => {
    const bySlug = new Map<string, { name: string; slug: string }>();
    products.forEach((product) => {
      product.categories.forEach((category) => {
        bySlug.set(category.slug, { name: category.name, slug: category.slug });
      });
    });
    return Array.from(bySlug.values()).sort((left, right) =>
      left.name.localeCompare(right.name, 'pt-BR')
    );
  }, [products]);

  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    const filtered = products.filter((product) => {
      const inTechnicalCategory =
        categoryFilter === 'all' ||
        product.categories.some((category) => category.slug === categoryFilter);
      const matchesSearch =
        !query ||
        `${product.name} ${product.brand ?? ''} ${product.variants[0]?.sku ?? ''}`
          .toLocaleLowerCase('pt-BR')
          .includes(query);
      return inTechnicalCategory && matchesSearch;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === 'price-asc') return productPrice(left) - productPrice(right);
      if (sortBy === 'price-desc') return productPrice(right) - productPrice(left);
      return 0;
    });
  }, [categoryFilter, products, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar
        categories={storefrontCategories}
        navigation={navigation}
        cartItemsCount={cartItemsCount}
        onCartToggle={() => {
          window.location.href = '/carrinho';
        }}
        activeCategory={null}
        onCategorySelect={() => undefined}
        onNavigateToHome={() => {
          window.location.href = '/';
        }}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
      />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-32 md:px-8">
        <header className="flex flex-col gap-5 border-b border-brand-border-soft pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-primary">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-brand-muted">
              {visibleProducts.length} {visibleProducts.length === 1 ? 'produto compatível' : 'produtos compatíveis'}
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
            <label className="sr-only" htmlFor="model-category-filter">
              Categoria técnica
            </label>
            <select
              id="model-category-filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-brand-white outline-none focus:border-blue-primary"
            >
              <option value="all">Todas as categorias técnicas</option>
              {technicalCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>

            <label className="flex h-10 items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-brand-white">
              <SlidersHorizontal className="h-4 w-4 text-brand-muted" />
              <span className="sr-only">Ordenar</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
                className="min-w-0 flex-1 bg-transparent outline-none"
              >
                <option value="relevance">Relevância</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
              </select>
            </label>
          </div>
        </header>

        {visibleProducts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-base text-brand-muted">Nenhum produto compatível disponível no momento.</p>
            <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-blue-primary hover:underline">
              Ver catálogo completo
            </Link>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => {
              const price = productPrice(product);
              const image = product.images[0];

              return (
                <Link
                  key={product.id}
                  href={`/produto/${product.slug}`}
                  className="group flex min-h-[360px] flex-col overflow-hidden rounded-lg border border-brand-border-soft bg-brand-surface transition hover:border-blue-primary/50"
                >
                  <div className="flex h-52 items-center justify-center border-b border-brand-border-soft bg-black/10 p-4">
                    {image ? (
                      <img
                        src={image.url}
                        alt={image.alt ?? product.name}
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="text-xs text-brand-muted">Imagem indisponível</span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
                      {product.brand ?? 'DJI'}
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white group-hover:text-blue-primary">
                      {product.name}
                    </h2>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <div>
                        <p className="text-[11px] text-brand-muted">À vista</p>
                        <p className="text-lg font-semibold text-green-accent">
                          R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-primary/30 bg-blue-primary/10 text-blue-primary">
                        <ShoppingCart className="h-4 w-4" />
                        <span className="sr-only">Ver produto</span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </main>

      <Footer categories={storefrontCategories} />
    </div>
  );
}
