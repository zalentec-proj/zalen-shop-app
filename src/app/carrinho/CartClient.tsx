'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Package,
  Truck,
  Shield,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import Footer from '@/components/layout/Footer';
import {
  addItem,
  createEmptyCart,
  getItemCount,
  removeItem,
  updateQuantity,
} from '@/modules/cart/cart.utils';
import type { Cart } from '@/modules/cart/cart.types';
import type { ProductSummary } from '@/modules/catalog/product.types';

// Inicializa o carrinho com 2 produtos mockados para demonstração
function buildDemoCart(products: ProductSummary[]): Cart {
  let cart = createEmptyCart();

  const mavic = products.find((p) => p.id === 'dji-mavic-3-pro');
  const bateria = products.find((p) => p.id === 'bateria-dji-mini-3-pro');

  if (mavic) {
    cart = addItem(cart, {
      productId: mavic.id,
      variantId: `${mavic.id}-v1`,
      name: mavic.name,
      imageUrl: mavic.imageUrl,
      unitPrice: mavic.price,
      quantity: 1,
    });
  }
  if (bateria) {
    cart = addItem(cart, {
      productId: bateria.id,
      variantId: `${bateria.id}-v1`,
      name: bateria.name,
      imageUrl: bateria.imageUrl,
      unitPrice: bateria.price,
      quantity: 1,
    });
  }
  return cart;
}

interface Props {
  products: ProductSummary[];
}

export default function CartClient({ products }: Props) {
  const [cart, setCart] = useState<Cart>(() => buildDemoCart(products));
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [orderNumber] = useState(`BD-${Math.floor(100000 + Math.random() * 900000)}`);

  const itemCount = getItemCount(cart);
  const shipping = cart.subtotal >= 500 ? 0 : 49.9;
  const total = cart.total + shipping;
  const recommendedProducts = products
    .filter((product) => !cart.items.some((item) => item.productId === product.id))
    .slice(0, 3);

  function handleUpdateQty(productId: string, variantId: string, qty: number) {
    setCart((c) => updateQuantity(c, productId, variantId, qty));
  }

  function handleRemove(productId: string, variantId: string) {
    setCart((c) => removeItem(c, productId, variantId));
  }

  function handleCheckout() {
    setCheckoutDone(true);
    setCart(createEmptyCart());
  }

  // ── Success state ──────────────────────────────────────────
  if (checkoutDone) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md glass-panel-strong rounded-[32px] p-10 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-accent/10 border-2 border-green-accent/30 flex items-center justify-center animate-pulse">
            <CheckCircle2 className="w-10 h-10 text-green-accent" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-[0.3em] text-green-accent uppercase">Pedido confirmado</span>
            <h2 className="text-2xl font-extrabold text-white mt-1 font-display">Voo Confirmado!</h2>
          </div>
          <p className="text-sm text-brand-muted">
            Pedido <span className="text-white font-mono font-bold">{orderNumber}</span> recebido com sucesso.
          </p>
          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-center">
              <span className="text-[10px] text-brand-muted uppercase block">Previsão</span>
              <span className="text-xs font-bold text-white">2 a 4 dias úteis</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-center">
              <span className="text-[10px] text-brand-muted uppercase block">Frete</span>
              <span className="text-xs font-bold text-green-accent">Grátis Brasil</span>
            </div>
          </div>
          <Link
            href="/"
            className="w-full h-12 rounded-xl bg-blue-primary text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-[0_6px_20px_rgba(30,61,255,0.3)]"
          >
            Continuar comprando
          </Link>
        </div>
      </div>
    );
  }

  // ── Empty cart ─────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-20 h-20 rounded-full glass-panel flex items-center justify-center">
          <ShoppingCart className="w-8 h-8 text-brand-muted" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Seu carrinho está vazio</h2>
          <p className="text-sm text-brand-muted mt-1">Adicione produtos para continuar.</p>
        </div>
        <Link
          href="/"
          className="px-8 h-12 rounded-xl bg-blue-primary text-white text-sm font-bold flex items-center gap-2 hover:opacity-95 transition-all shadow-[0_6px_20px_rgba(30,61,255,0.3)]"
        >
          <ArrowLeft className="w-4 h-4" />
          Ver produtos
        </Link>
      </div>
    );
  }

  // ── Cart ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg relative">
      <div className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full glow-radial pointer-events-none -z-10 opacity-30" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-transparent">
        <nav className="max-w-7xl mx-auto h-[72px] px-6 rounded-full flex items-center justify-between navbar-glass shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
          <Link href="/" className="flex items-center gap-2 text-brand-muted hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Continuar comprando
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand-muted" />
            <span className="text-sm font-bold text-white">
              Carrinho ({itemCount} {itemCount === 1 ? 'item' : 'itens'})
            </span>
          </div>
          <div className="w-32" />
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Items list */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <h1 className="text-2xl font-black text-white font-display mb-2">Seu Carrinho</h1>

            {cart.items.map((item) => (
              <div
                key={`${item.productId}-${item.variantId}`}
                className="glass-panel rounded-2xl p-5 flex items-center gap-5 transition-all hover:border-white/20"
              >
                {/* Image */}
                <div className="w-20 h-20 shrink-0 rounded-xl bg-white/[0.03] border border-brand-border-soft flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-brand-muted" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{item.name}</h3>
                  {item.sku && <p className="text-[11px] text-brand-muted mt-0.5">SKU: {item.sku}</p>}
                  <p className="text-base font-extrabold text-green-accent mt-1">
                    R$ {(item.unitPrice * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-brand-muted">
                    R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cada
                  </p>
                </div>

                {/* Quantity + Remove */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <button
                    onClick={() => handleRemove(item.productId, item.variantId)}
                    className="p-1.5 rounded-lg text-brand-muted hover:text-red-500 hover:bg-red-500/10 transition-all"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-0 glass-panel-soft rounded-xl overflow-hidden border border-brand-border">
                    <button
                      onClick={() => handleUpdateQty(item.productId, item.variantId, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-white">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQty(item.productId, item.variantId, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1 flex flex-col gap-4 lg:sticky lg:top-32">
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold text-white">Resumo do pedido</h2>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-brand-muted">
                  <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'itens'})</span>
                  <span className="text-white">R$ {cart.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-brand-muted">
                  <span>Frete</span>
                  {shipping === 0 ? (
                    <span className="text-green-accent font-bold">Grátis</span>
                  ) : (
                    <span className="text-white">R$ {shipping.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  )}
                </div>
                {shipping > 0 && (
                  <p className="text-[11px] text-brand-muted">
                    Frete grátis em compras acima de R$ 500
                  </p>
                )}
              </div>

              <div className="h-px bg-brand-border-soft" />

              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Total</span>
                <span className="text-2xl font-extrabold text-green-accent">
                  R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <p className="text-[11px] text-brand-muted text-center">
                ou 12x de R$ {(total / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros
              </p>

              <button
                onClick={handleCheckout}
                className="w-full h-12 rounded-xl bg-blue-primary text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-[0_8px_24px_rgba(30,61,255,0.3)] hover:scale-[1.02] cursor-pointer"
              >
                Finalizar pedido
              </button>

              <p className="text-[10px] text-brand-muted text-center">
                ⚠️ Pagamento real não implementado ainda
              </p>
            </div>

            {/* Trust badges */}
            <div className="glass-panel-soft rounded-2xl p-4 flex flex-col gap-3">
              {[
                { icon: Truck, text: 'Frete grátis acima de R$ 500' },
                { icon: Shield, text: 'Compra 100% segura' },
                { icon: Package, text: 'Produtos originais DJI' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-xs text-brand-muted">
                  <Icon className="w-4 h-4 text-blue-primary shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {recommendedProducts.length > 0 && (
          <section className="mt-16 flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-brand-muted uppercase tracking-widest mb-1">Sugestões</p>
                <h2 className="text-2xl font-black text-white font-display">Complete o setup</h2>
                <p className="text-sm text-brand-muted mt-2">
                  Seleção mockada do catálogo para continuar a jornada de compra.
                </p>
              </div>
              <Link href="/" className="text-sm text-blue-primary hover:underline flex items-center gap-1">
                Ver catálogo completo
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendedProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/produto/${product.slug}`}
                  className="group glass-panel rounded-[24px] overflow-hidden flex flex-col transition-all duration-500 hover:border-white/20 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
                >
                  <div className="w-full h-52 border-b border-brand-border-soft bg-gradient-to-b from-white/[0.04] via-transparent to-transparent p-5 flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-brand-muted" />
                    )}
                  </div>

                  <div className="p-5 flex flex-col gap-3">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-brand-muted uppercase">
                        {product.categories[0]?.name ?? 'Catálogo'}
                      </span>
                      <h3 className="text-[15px] font-bold text-white tracking-tight line-clamp-1 mt-1 group-hover:text-blue-primary transition-colors">
                        {product.name}
                      </h3>
                    </div>

                    <div>
                      <span className="text-[11px] text-brand-muted">
                        12x de R$ {(product.price / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-lg font-extrabold text-green-accent">
                        R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-brand-border-soft flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-white group-hover:text-blue-primary transition-colors">
                        Abrir produto
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
