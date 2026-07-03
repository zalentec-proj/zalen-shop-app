'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingCart,
  Star,
  Package,
  Truck,
  Shield,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import Footer from '@/components/layout/Footer';
import { addStoredCartItem } from '@/modules/cart/cart.storage';
import type { Product, ProductSummary } from '@/modules/catalog/product.types';
import { pushMarketingEvent } from '@/modules/marketing/marketing.client';

interface Props {
  product: Product;
  relatedProducts: ProductSummary[];
}

export default function ProductDetailClient({ product, relatedProducts }: Props) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const variant = product.variants[0];
  const price = variant?.price ?? 0;
  const stock = variant?.stock ?? 0;
  const monthly = (price / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  function handleAddToCart() {
    if (!variant) {
      return;
    }

    addStoredCartItem({
      productId: product.id,
      variantId: variant.id,
      sku: variant.sku,
      name: product.name,
      imageUrl: product.images[0]?.url,
      unitPrice: price,
      quantity,
    });
    pushMarketingEvent({
      event: 'add_to_cart',
      event_id: `add_to_cart:${product.id}:${variant.id}:${Date.now()}`,
      ecommerce: {
        currency: 'BRL',
        value: price * quantity,
        items: [
          {
            item_id: variant.sku ?? variant.id,
            item_name: product.name,
            item_brand: product.brand,
            item_category: product.categories[0]?.name,
            price,
            quantity,
          },
        ],
      },
      meta: {
        eventName: 'AddToCart',
        contentIds: [variant.sku ?? variant.id],
        contentName: product.name,
      },
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  return (
    <div className="min-h-screen bg-brand-bg relative">
      {/* Background orbs */}
      <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full glow-radial pointer-events-none -z-10 opacity-40" />
      <div className="absolute top-[50%] right-[-5%] w-[400px] h-[400px] rounded-full glow-radial-green pointer-events-none -z-10 opacity-30" />

      {/* Top nav bar */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-transparent">
        <nav className="max-w-7xl mx-auto h-[72px] px-6 rounded-full flex items-center justify-between navbar-glass shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
          <Link
            href="/"
            className="flex items-center gap-2 text-brand-muted hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar à loja
          </Link>
          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-brand-muted">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-3 h-3" />
            {product.categories[0] && (
              <>
                <Link
                  href={`/categoria/${product.categories[0].slug}`}
                  className="hover:text-white transition-colors"
                >
                  {product.categories[0].name}
                </Link>
                <ChevronRight className="w-3 h-3" />
              </>
            )}
            <span className="text-brand-white truncate max-w-[200px]">{product.name}</span>
          </div>
          <div className="w-24" />
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left — Images */}
          <div className="flex flex-col gap-4">
            {/* Main image */}
            <div className="w-full aspect-square rounded-3xl glass-panel overflow-hidden flex items-center justify-center p-8 relative">
              {product.isNew && (
                <span className="absolute top-4 left-4 bg-blue-primary/10 border border-blue-primary/40 rounded-full px-3 py-1 text-[10px] font-bold text-blue-primary uppercase tracking-wider">
                  Novo
                </span>
              )}
              {product.isBestSeller && (
                <span className="absolute top-4 right-4 bg-green-accent/15 border border-green-accent/30 rounded-full px-3 py-1 text-[10px] font-bold text-green-accent uppercase tracking-wider">
                  Mais Vendido
                </span>
              )}
              <img
                src={product.images[selectedImage]?.url}
                alt={product.images[selectedImage]?.alt ?? product.name}
                className="w-full h-full object-contain drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)] select-none"
              />
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center p-2 ${
                      selectedImage === idx
                        ? 'border-blue-primary shadow-[0_0_12px_rgba(30,61,255,0.4)] bg-blue-primary/10'
                        : 'border-brand-border bg-brand-surface hover:border-white/20'
                    }`}
                  >
                    <img src={img.url} alt={img.alt ?? ''} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right — Info */}
          <div className="flex flex-col gap-6 pt-2">
            {/* Category + Brand */}
            <div className="flex items-center gap-2 flex-wrap">
              {product.categories[0] && (
                <Link
                  href={`/categoria/${product.categories[0].slug}`}
                  className="text-[11px] font-bold tracking-widest text-brand-muted uppercase hover:text-blue-primary transition-colors"
                >
                  {product.categories[0].name}
                </Link>
              )}
              {product.brand && (
                <>
                  <span className="text-brand-border">·</span>
                  <span className="text-[11px] font-bold tracking-widest text-brand-muted uppercase">
                    {product.brand}
                  </span>
                </>
              )}
            </div>

            {/* Name */}
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight font-display leading-tight">
              {product.name}
            </h1>

            {/* Rating */}
            {product.rating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.round(product.rating!) ? 'text-yellow-500 fill-yellow-500' : 'text-brand-border'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-brand-muted">
                  {product.rating} ({product.reviewsCount} avaliações)
                </span>
              </div>
            )}

            {/* Price */}
            <div className="glass-panel-soft rounded-2xl p-5 flex flex-col gap-1">
              <span className="text-xs text-brand-muted">12x de R$ {monthly} sem juros</span>
              <span className="text-4xl font-extrabold text-green-accent font-sans">
                R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-brand-muted mt-1">
                ou R$ {(price * 0.95).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Pix (5% off)
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-brand-muted leading-relaxed">{product.description}</p>
            )}

            {/* Specs */}
            {product.specs && product.specs.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {product.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="glass-panel-soft rounded-xl p-3 flex flex-col gap-0.5"
                  >
                    <span className="text-[10px] text-brand-muted uppercase tracking-wider">{spec.label}</span>
                    <span className="text-sm font-bold text-white">{spec.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-green-accent" />
              {stock > 0 ? (
                <span className="text-green-accent font-medium">
                  {stock <= 5 ? `Apenas ${stock} em estoque` : 'Em estoque'}
                </span>
              ) : (
                <span className="text-red-500 font-medium">Fora de estoque</span>
              )}
            </div>

            {/* Quantity + CTA */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Quantity selector */}
              <div className="flex items-center gap-0 glass-panel-soft rounded-xl overflow-hidden border border-brand-border">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-11 flex items-center justify-center text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-lg font-bold"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-bold text-white">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  className="w-10 h-11 flex items-center justify-center text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-lg font-bold"
                >
                  +
                </button>
              </div>

              {/* Add to cart */}
              <button
                onClick={handleAddToCart}
                disabled={stock === 0}
                className={`flex-1 h-12 rounded-xl text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  addedToCart
                    ? 'bg-green-accent text-[#05070B] shadow-[0_0_20px_rgba(0,230,118,0.4)]'
                    : 'bg-blue-primary text-white hover:opacity-95 shadow-[0_8px_24px_rgba(30,61,255,0.3)] hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {addedToCart ? 'Adicionado!' : 'Adicionar ao carrinho'}
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/carrinho"
                className="h-11 px-5 rounded-xl glass-panel-soft border border-brand-border text-sm font-semibold text-white hover:border-white/20 transition-colors flex items-center gap-2"
              >
                <ShoppingCart className="w-4 h-4 text-blue-primary" />
                Ver carrinho
              </Link>
              {product.categories[0] && (
                <Link
                  href={`/categoria/${product.categories[0].slug}`}
                  className="h-11 px-5 rounded-xl bg-white/[0.03] border border-brand-border-soft text-sm font-semibold text-brand-muted hover:text-white hover:border-white/20 transition-colors flex items-center gap-2"
                >
                  Explorar categoria
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-brand-border-soft">
              {[
                { icon: Truck, label: 'Frete grátis', sub: 'Para todo Brasil' },
                { icon: Shield, label: 'Garantia DJI', sub: '12 meses' },
                { icon: Package, label: 'Original', sub: '100% autêntico' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center gap-1 text-center">
                  <Icon className="w-5 h-5 text-blue-primary" />
                  <span className="text-[11px] font-bold text-white">{label}</span>
                  <span className="text-[10px] text-brand-muted">{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-20 flex flex-col gap-8">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-brand-muted uppercase tracking-widest mb-1">
                  Catálogo relacionado
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white font-display">
                  Continue explorando
                </h2>
                <p className="text-sm text-brand-muted mt-2">
                  Produtos da mesma frente de voo para complementar este setup.
                </p>
              </div>
              <Link
                href="/"
                className="text-sm text-blue-primary hover:underline flex items-center gap-1"
              >
                Ver catálogo completo
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct.id}
                  href={`/produto/${relatedProduct.slug}`}
                  className="group glass-panel rounded-[24px] overflow-hidden flex flex-col transition-all duration-500 hover:border-white/20 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
                >
                  <div className="w-full h-56 border-b border-brand-border-soft bg-gradient-to-b from-white/[0.04] via-transparent to-transparent p-5 flex items-center justify-center overflow-hidden">
                    {relatedProduct.imageUrl && (
                      <img
                        src={relatedProduct.imageUrl}
                        alt={relatedProduct.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    )}
                  </div>

                  <div className="p-5 flex flex-col gap-3">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-brand-muted uppercase">
                        {relatedProduct.categories[0]?.name ?? 'Catálogo'}
                      </span>
                      <h3 className="text-[15px] font-bold text-white tracking-tight line-clamp-1 mt-1 group-hover:text-blue-primary transition-colors">
                        {relatedProduct.name}
                      </h3>
                    </div>

                    <div>
                      <span className="text-[11px] text-brand-muted">
                        12x de R$ {(relatedProduct.price / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-lg font-extrabold text-green-accent">
                        R$ {relatedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-brand-border-soft flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-white group-hover:text-blue-primary transition-colors">
                        Ver detalhes
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-blue-primary" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
