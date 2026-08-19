'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { SafeCatalogImage } from '@/components/ui/SafeCatalogImage';
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

      <main className="mx-auto max-w-7xl px-3 pb-14 pt-24 md:px-8 md:pt-44 lg:pt-48">
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
              className="h-10 rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-brand-white outline-none [color-scheme:dark] focus:border-blue-primary"
            >
              <option value="all" className="bg-[#0B1018] text-white">
                Todas as categorias técnicas
              </option>
              {technicalCategories.map((category) => (
                <option key={category.slug} value={category.slug} className="bg-[#0B1018] text-white">
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
                className="min-w-0 flex-1 bg-transparent text-white outline-none [color-scheme:dark]"
              >
                <option value="relevance" className="bg-[#0B1018] text-white">
                  Relevância
                </option>
                <option value="price-asc" className="bg-[#0B1018] text-white">
                  Menor preço
                </option>
                <option value="price-desc" className="bg-[#0B1018] text-white">
                  Maior preço
                </option>
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
          <section className="grid grid-cols-2 gap-3 pt-6 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => {
              const price = productPrice(product);
              const image = product.images[0];

              return (
                <Link
                  key={product.id}
                  href={`/produto/${product.slug}`}
                  className="group flex min-h-[270px] flex-col overflow-hidden rounded-lg border border-brand-border-soft bg-brand-surface transition hover:border-blue-primary/50 sm:min-h-[320px]"
                >
                  <div className="flex h-32 items-center justify-center border-b border-brand-border-soft bg-black/10 p-2 sm:h-44 sm:p-3 md:h-52 md:p-4">
                    <SafeCatalogImage
                      src={image?.url}
                      alt={image?.alt ?? product.name}
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <p className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted sm:block">
                      {product.brand ?? 'DJI'}
                    </p>
                    <h2 className="line-clamp-2 text-[12px] font-semibold leading-4 text-white group-hover:text-blue-primary sm:mt-1 sm:text-sm sm:leading-5">
                      {product.name}
                    </h2>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-4 sm:gap-3 sm:pt-5">
                      <div>
                        <p className="hidden text-[11px] text-brand-muted sm:block">À vista</p>
                        <p className="text-base font-semibold text-green-accent sm:text-lg">
                          R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-primary/30 bg-blue-primary/10 text-blue-primary sm:h-9 sm:w-9">
                        <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
