'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
import type { Product, CartItem } from './types';
import { CheckCircle2, Calendar, MapPin } from 'lucide-react';

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
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const mavic = products.find((p) => p.id === 'dji-mavic-3-pro');
    const baterial = products.find((p) => p.id === 'bateria-dji-mini-3-pro');

    const items: CartItem[] = [];
    if (mavic) {
      items.push({ product: mavic, quantity: 1 });
    }
    if (baterial) {
      items.push({ product: baterial, quantity: 1 });
    }
    return items;
  });

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  const cartItemsCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

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
    setCartItems((prevItems) => {
      const existing = prevItems.find((item) => item.product.id === product.id);
      if (existing) {
        return prevItems.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prevItems, { product, quantity }];
    });

    setCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, qty: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleCheckout = () => {
    const orderId = `BD-${Math.floor(100000 + Math.random() * 900000)}`;
    const totalOrder = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

    setLastOrderDetails({
      id: orderId,
      total: totalOrder,
      items: [...cartItems],
    });

    setCartOpen(false);
    setCheckoutSuccess(true);
    setCartItems([]);
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
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />

      {checkoutSuccess && lastOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#05070B]/85 backdrop-blur-xl" onClick={() => setCheckoutSuccess(false)}></div>

          <div className="relative w-full max-w-lg glass-panel-strong rounded-[32px] p-8 md:p-10 text-center flex flex-col items-center gap-6 shadow-[0_30px_100px_rgba(0,0,0,0.8)] z-10 animate-scale-in">
            <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-green-accent/10 border-2 border-green-accent/30 shadow-[0_0_25px_rgba(0,230,118,0.2)] animate-pulse mb-2">
              <CheckCircle2 className="w-10 h-10 text-green-accent" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold tracking-[0.3em] text-green-accent uppercase font-display">
                PEDIDO ENVIADO PARA CALIBRAÇÃO
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
                Voo Confirmado!
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-brand-muted max-w-sm">
              Seu pedido <span className="text-white font-mono font-bold">{lastOrderDetails.id}</span> foi recebido com sucesso. Nossa equipe iniciará agora os testes de bancada e homologação DJI de hardware antes de efetuar o despacho seguro.
            </p>

            <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-5 text-left flex flex-col gap-3">
              <div className="flex justify-between items-center pb-2 border-b border-white/5 text-xs text-brand-muted">
                <span>ITENS DO COMPROVANTE</span>
                <span className="font-mono text-white">QTD</span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[120px] overflow-y-auto">
                {lastOrderDetails.items.map((item: CartItem) => (
                  <div key={item.product.id} className="flex justify-between items-center text-xs">
                    <span className="text-white font-medium line-clamp-1 max-w-[200px]">{item.product.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-brand-muted font-mono">{item.quantity}x</span>
                      <span className="text-green-accent font-bold">R$ {(item.product.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-baseline pt-3 border-t border-white/5">
                <span className="text-xs font-bold text-white font-display">VALOR TOTAL DO PEDIDO:</span>
                <span className="text-lg font-extrabold text-green-accent font-sans">
                  R$ {lastOrderDetails.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex items-center gap-2.5 text-left">
                <Calendar className="w-4 h-4 text-blue-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-muted uppercase">Previsão</span>
                  <span className="text-[11px] font-bold text-white">2 a 4 dias úteis</span>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex items-center gap-2.5 text-left">
                <MapPin className="w-4 h-4 text-green-accent shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-muted uppercase">Frete</span>
                  <span className="text-[11px] font-bold text-green-accent uppercase">Grátis Brasil</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCheckoutSuccess(false)}
              className="w-full h-12 rounded-xl text-xs font-bold tracking-widest text-white bg-blue-primary hover:opacity-95 transition-all cursor-pointer shadow-[0_6px_20px_rgba(30,61,255,0.3)] flex items-center justify-center gap-2"
            >
              CONCLUIR PROTOCOLO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
