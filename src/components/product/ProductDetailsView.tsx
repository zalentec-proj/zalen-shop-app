import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart, ShieldCheck, Play, Sparkles } from 'lucide-react';
import { Product } from '../../types';
import { SafeCatalogImage } from '../ui/SafeCatalogImage';
import { ProductDescription } from './ProductDescription';

interface ProductDetailsViewProps {
  product: Product;
  onBackToHome: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onBuyNow: (product: Product, quantity: number) => void;
}

export default function ProductDetailsView({ product, onBackToHome, onAddToCart, onBuyNow }: ProductDetailsViewProps) {
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setSelectedImage(product.image);
    setQuantity(1);
    setAdded(false);
  }, [product]);

  // Installment computations
  const monthlyInstallment = (product.price / 12).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleAddToCartClick = () => {
    if (!product.isAvailable) return;
    onAddToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNowClick = () => {
    if (!product.isAvailable) return;
    onBuyNow(product, quantity);
  };

  const imagesList = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <div className="w-full px-6 md:px-12 pt-28 md:pt-36 pb-20 animate-fade-in" id="detalhes-produto">
      <div className="max-w-7xl mx-auto flex flex-col gap-6 text-left">
        
        {/* Top interactive Breadcrumbs & Go Back button */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border-soft pb-4">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-brand-muted hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            VOLTAR AO CATÁLOGO
          </button>
          
          <div className="text-[10px] text-brand-muted font-normal font-mono uppercase tracking-wider">
            Início &gt; <span className="hover:text-blue-primary cursor-pointer" onClick={onBackToHome}>{product.category}</span> &gt; <span className="text-white font-semibold">{product.name}</span>
          </div>
        </div>

        {/* Main 2-column detail grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mt-2">
          
          {/* Left Column: Product Gallery View (Takes 6 grid columns) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            
            <div className="glass-panel rounded-2xl p-0 h-[280px] sm:h-[400px] flex items-center justify-center relative overflow-hidden group">
              {/* Inner ambient light overlay */}
              <div className="absolute inset-0 bg-blue-primary/[0.01] pointer-events-none"></div>
              
              <SafeCatalogImage
                src={selectedImage}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 select-none pointer-events-none"
                referrerPolicy="no-referrer"
              />

              {/* Assistance Video Floating Trigger button */}
              <button 
                onClick={() => alert("Vídeo de demonstração técnica e unbox do produto carregando... (Simulação)")}
                className="absolute bottom-4 left-4 h-8 px-3 rounded-lg bg-[#02040b]/60 hover:bg-[#02040b]/85 border border-white/5 text-[9px] font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md active:scale-95"
              >
                <Play className="w-2.5 h-2.5 fill-white text-white" />
                ASSISTIR VÍDEO
              </button>
            </div>

            {/* Thumbnails list (Max 4 as requested) */}
            <div className="grid grid-cols-4 gap-3">
              {imagesList.slice(0, 4).map((imgUrl, idx) => {
                const isActive = selectedImage === imgUrl;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(imgUrl)}
                    className={`h-14 sm:h-18 rounded-xl p-0 bg-white/[0.02] border transition-all flex items-center justify-center overflow-hidden cursor-pointer ${
                      isActive 
                        ? 'border-blue-primary bg-blue-primary/10 shadow-[0_0_8px_rgba(30,61,255,0.3)]' 
                        : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    <SafeCatalogImage
                      src={imgUrl}
                      alt={`Thumb ${idx}`}
                      className="w-full h-full object-cover filter hover:brightness-110 select-none pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                );
              })}
            </div>

          </div>

          {/* Right Column: Descriptions & technical CTA layout (Takes 6 columns) */}
          <div className="lg:col-span-6 flex flex-col gap-5 text-left">
            
            {/* Tag label */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-blue-primary/10 border border-blue-primary/20 rounded py-0.5 px-2 text-[9px] font-semibold tracking-wider text-blue-primary uppercase font-mono">
                <Sparkles className="w-2.5 h-2.5 text-blue-primary" />
                {product.isAvailable ? 'Disponível para compra' : 'Temporariamente esgotado'}
              </span>
              {product.sku ? (
                <span className="text-[10px] text-brand-muted font-normal">SKU {product.sku}</span>
              ) : null}
            </div>

            {/* Headings */}
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl sm:text-3xl lg:text-3xl font-extrabold tracking-tight text-white font-display">
                {product.name}
              </h1>
              <p className="text-xs sm:text-sm font-medium text-brand-muted tracking-wide">
                {product.subtitle || 'Eleve sua criatividade para outro nível.'}
              </p>
            </div>

            {/* Pricing Section - Green emphasis price */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-brand-muted uppercase tracking-wider font-mono">PREÇO À VISTA</span>
                <span className="text-2xl md:text-3xl font-bold text-green-accent font-sans">
                  R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-brand-muted">
                  Valor confirmado novamente no checkout
                </span>
              </div>
              
              <div className="h-[1px] sm:h-10 w-full sm:w-[1px] bg-brand-border-soft"></div>

              <div className="flex flex-col text-left sm:text-right">
                <span className="text-xs font-semibold text-white block">12x de R$ {monthlyInstallment}</span>
                <span className="text-[10px] text-green-accent font-medium mt-0.5">Sem juros no cartão de crédito</span>
              </div>
            </div>

            {/* Technical Specs quick display (4 items maximum as requested) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
              {product.specs.slice(0, 4).map((spec, index) => (
                <div key={index} className="bg-white/[0.01] border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5 hover:border-white/10 transition-colors">
                  <span className="text-[9px] uppercase tracking-wider text-brand-muted font-mono">{spec.label}</span>
                  <span className="text-[11px] font-bold text-white font-display overflow-hidden text-ellipsis whitespace-nowrap">{spec.value}</span>
                </div>
              ))}
            </div>

            {/* Dynamic Interactive controls */}
            <div className="flex flex-col gap-3 pt-3 border-t border-brand-border-soft">
              
              {/* Quantity selectors */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold tracking-wider text-brand-muted uppercase font-display">Quantidade:</span>
                <div className="inline-flex items-center h-8.5 bg-white/[0.02] border border-white/5 rounded-lg px-1.5">
                  <button
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(quantity - 1)}
                    className="w-6 h-6 flex items-center justify-center text-brand-muted hover:bg-white/5 hover:text-white rounded font-bold disabled:opacity-45 select-none cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-mono text-xs text-white font-bold select-none">
                    {quantity}
                  </span>
                  <button
                    disabled={!product.isAvailable || quantity >= product.stock}
                    onClick={() => setQuantity(Math.min(quantity + 1, product.stock))}
                    className="w-6 h-6 flex items-center justify-center text-brand-muted hover:bg-white/5 hover:text-white rounded font-bold select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* CTA buttons double deck layout */}
              <div className="flex flex-col sm:flex-row gap-3 mt-1">
                <button
                  onClick={handleBuyNowClick}
                  disabled={!product.isAvailable}
                  className="flex-1 h-11 rounded-full text-xs font-semibold tracking-wide text-white gradient-button relative group flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_10px_20px_rgba(30,61,255,0.25)] active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {!product.isAvailable ? 'Produto esgotado' : 'Comprar agora'}
                </button>

                {/* Adicionar ao carrinho CTA */}
                <button
                  onClick={handleAddToCartClick}
                  disabled={!product.isAvailable}
                  className="px-6 h-11 rounded-full text-xs font-semibold tracking-wide text-brand-white bg-white/[0.03] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:text-slate-600"
                >
                  Adicionar ao carrinho
                </button>
              </div>

            </div>

          </div>

          {/* Description stays below the gallery on desktop and after purchase actions on mobile. */}
          {product.description ? (
            <div className="lg:col-span-6 lg:col-start-1 rounded-2xl border border-white/5 bg-white/[0.01] p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-bold tracking-tight text-white font-display">
                Descrição do produto
              </h2>
              <ProductDescription description={product.description} />
            </div>
          ) : null}

        </div>

        {/* Product detailed benefits footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-10 pt-6 border-t border-brand-border-soft">
          <div className="flex items-center gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-blue-primary" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white">Garantia DJI Oficial</span>
              <span className="text-[9.5px]/[13px] text-brand-muted">Suporte e cobertura nacional</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-green-accent" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white">Envio Imediato Próprio</span>
              <span className="text-[9.5px]/[13px] text-brand-muted">Embalagem especial anti-choque</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-blue-primary" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white">Configuração Técnica</span>
              <span className="text-[9.5px]/[13px] text-brand-muted">Apoio fino antes de voar</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-green-accent" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white">100% Homologado</span>
              <span className="text-[9.5px]/[13px] text-brand-muted">Segurança jurídica no Brasil</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
