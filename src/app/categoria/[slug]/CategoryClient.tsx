'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingCart,
  Star,
  SlidersHorizontal,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import Footer from '@/components/layout/Footer';
import type { Category, Product } from '@/modules/catalog/product.types';

interface Props {
  category: Category;
  products: Product[];
  categories: Category[];
}

export default function CategoryClient({ category, products, categories }: Props) {
  const [sortBy, setSortBy] = useState<'relevance' | 'price-asc' | 'price-desc'>('relevance');

  const sorted = [...products].sort((a, b) => {
    const pa = a.variants[0]?.price ?? 0;
    const pb = b.variants[0]?.price ?? 0;
    if (sortBy === 'price-asc') return pa - pb;
    if (sortBy === 'price-desc') return pb - pa;
    return 0;
  });

  return (
    <div className="min-h-screen bg-brand-bg relative">
      <div className="absolute top-[5%] left-[15%] w-[500px] h-[500px] rounded-full glow-radial pointer-events-none -z-10 opacity-30" />

      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-transparent">
        <nav className="max-w-7xl mx-auto h-[72px] px-6 rounded-full flex items-center justify-between navbar-glass shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
          <Link href="/" className="flex items-center gap-2 text-brand-muted hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-brand-muted">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-brand-white">{category.name}</span>
          </div>
          <Link
            href="/carrinho"
            className="text-sm font-medium text-brand-muted hover:text-white transition-colors"
          >
            Carrinho
          </Link>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 pb-20">
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
              className="bg-transparent text-sm text-brand-white focus:outline-none cursor-pointer"
            >
              <option value="relevance" className="bg-[#05070B]">Relevância</option>
              <option value="price-asc" className="bg-[#05070B]">Menor preço</option>
              <option value="price-desc" className="bg-[#05070B]">Maior preço</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          {categories.map((item) => {
            const isActive = item.slug === category.slug;
            return (
              <Link
                key={item.id}
                href={`/categoria/${item.slug}`}
                className={`h-10 px-4 rounded-full border text-sm font-medium transition-colors flex items-center ${
                  isActive
                    ? 'border-blue-primary bg-blue-primary/10 text-white'
                    : 'border-brand-border-soft bg-white/[0.02] text-brand-muted hover:text-white hover:border-white/20'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Grid */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-brand-muted text-lg">Nenhum produto nesta categoria ainda.</p>
            <Link href="/" className="text-blue-primary text-sm hover:underline">Ver todos os produtos</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sorted.map((product) => {
              const variant = product.variants[0];
              const price = variant?.price ?? 0;
              const monthly = (price / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              return (
                <Link
                  key={product.id}
                  href={`/produto/${product.slug}`}
                  className="group glass-panel rounded-[24px] overflow-hidden flex flex-col transition-all duration-500 hover:border-white/20 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.55)] relative"
                >
                  {/* Image */}
                  <div className="w-full h-52 relative overflow-hidden bg-gradient-to-b from-white/[0.04] via-transparent to-transparent border-b border-brand-border-soft flex items-center justify-center p-4">
                    {product.isNew && (
                      <span className="absolute top-3 left-3 z-10 bg-blue-primary/10 border border-blue-primary/40 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-blue-primary uppercase tracking-wider">
                        Novo
                      </span>
                    )}
                    <img
                      src={product.images[0]?.url}
                      alt={product.images[0]?.alt ?? product.name}
                      className="w-full h-full object-cover group-hover:scale-110 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-all duration-500 select-none"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col gap-3">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-brand-muted uppercase">{product.brand}</span>
                      <h3 className="text-[15px] font-bold text-white tracking-tight line-clamp-1 group-hover:text-blue-primary transition-colors mt-0.5">
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
                      <span className="text-[11px] text-brand-muted">12x de R$ {monthly}</span>
                      <p className="text-lg font-extrabold text-green-accent">
                        R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-brand-border-soft">
                      <span className="text-xs font-semibold text-brand-white group-hover:text-blue-primary transition-colors">
                        Ver detalhes
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-primary/10 border border-blue-primary/20 text-blue-primary flex items-center justify-center group-hover:bg-blue-primary group-hover:text-white transition-all">
                          <ShoppingCart className="w-4 h-4" />
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

      <Footer categories={categories} />
    </div>
  );
}
