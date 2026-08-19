import React, { useState } from 'react';
import { ShoppingCart, Heart, Eye } from 'lucide-react';
import { Product } from '../../types';
import { SafeCatalogImage } from '../ui/SafeCatalogImage';

interface ProductCardProps {
  product: Product;
  onProductClick: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  key?: string | number;
}

export default function ProductCard({ product, onProductClick, onAddToCart }: ProductCardProps) {
  const [favorite, setFavorite] = useState(false);

  // Compute monthly installment
  const monthlyInstallment = (product.price / 12).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl glass-panel transition-all duration-500 hover:-translate-y-2 hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.55)] sm:rounded-[20px] md:rounded-[24px]">
      
      {/* Decorative inner background pulse for tech feeling */}
      <div className="absolute inset-0 bg-[#070B14]/40 -z-10 group-hover:bg-[#091021]/50 transition-colors"></div>

      {/* Product Image Stage (Moves to the very top, full edge-to-edge, with premium background layout) */}
      <div
        onClick={() => onProductClick(product.id)}
        className="relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden border-b border-brand-border-soft bg-gradient-to-b from-white/[0.04] via-transparent to-transparent p-2 sm:h-44 sm:p-3 md:h-52 md:p-4"
      >
        {/* Absolute Badges on top of image */}
        <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-col items-start gap-1.5 sm:left-3 sm:top-3 md:left-4 md:top-4">
          {!product.isAvailable && (
            <span className="inline-flex items-center rounded-full border border-red-300/45 bg-red-600 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_0_14px_rgba(239,68,68,0.45)]">
              Sem estoque
            </span>
          )}
          {product.isNew && (
            <span className="inline-flex items-center bg-blue-primary/10 border border-blue-primary/40 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-blue-primary uppercase tracking-wider shadow-[0_0_8px_rgba(30,61,255,0.3)]">
              Novo
            </span>
          )}
          {product.isBestSeller && !product.isNew && (
            <span className="inline-flex items-center bg-green-accent/15 border border-green-accent/30 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-green-accent uppercase tracking-wider shadow-[0_0_8px_rgba(0,230,118,0.2)]">
              Mais Vendido
            </span>
          )}
        </div>

        {/* Absolute Wishlist toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFavorite(!favorite);
          }}
          className={`absolute right-3 top-3 z-20 hidden h-8 w-8 items-center justify-center rounded-full border transition-all cursor-pointer sm:flex md:right-4 md:top-4 ${
            favorite
              ? 'bg-red-500/15 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
              : 'border-white/10 bg-black/40 text-brand-white hover:border-white/20 hover:text-white hover:scale-105'
          }`}
        >
          <Heart className={`w-4 h-4 ${favorite ? 'fill-red-500' : ''}`} />
        </button>

        {/* Drone Image: Perfectly balanced space sizing taking up the full area optimally */}
        <SafeCatalogImage
          src={product.image}
          alt={product.name}
          className="z-10 h-full w-full select-none object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-all duration-500 group-hover:scale-105 pointer-events-none"
          referrerPolicy="no-referrer"
        />

        {/* Soft hovering quick view circle overlay */}
        <div className="absolute inset-0 bg-brand-bg/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-350 z-15">
          <div className="w-10 h-10 rounded-full bg-blue-primary text-white flex items-center justify-center shadow-[0_0_15px_#1E3DFF]">
            <Eye className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Info Details layout */}
      <div className="relative flex flex-col gap-2 p-3 pt-2 text-left sm:gap-2.5 sm:p-4 sm:pt-3 md:gap-3 md:p-6 md:pt-2">
        <div className="flex cursor-pointer flex-col gap-1" onClick={() => onProductClick(product.id)}>
          {/* Category breadcrumb */}
          <span className="hidden text-[10px] font-bold uppercase tracking-widest text-brand-muted sm:block font-display">
            {product.category}
          </span>
          <h3 className="min-h-8 line-clamp-2 text-[12px] font-bold leading-4 tracking-tight text-white transition-colors group-hover:text-blue-primary sm:min-h-0 sm:text-[14px] sm:leading-5 md:text-[15px]">
            {product.name}
          </h3>
        </div>

        {/* Pricing Layout */}
        <div className="flex flex-col gap-0.5">
          {/* Installments in gray (discrete) */}
          <span className="text-[10px] text-brand-muted sm:text-[11px]">
            12x de R$ {monthlyInstallment} sem juros
          </span>
          {/* Large green-accent price */}
          <span className="text-base font-extrabold text-green-accent sm:text-lg font-sans">
            R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Quick add triggers */}
        <div className="mt-1 flex items-center justify-between border-t border-brand-border-soft pt-2 sm:pt-3">
          <button
            onClick={() => onProductClick(product.id)}
            className="cursor-pointer text-[11px] font-semibold text-brand-white transition-colors group-hover:text-blue-primary sm:text-xs"
          >
            Ver detalhes
          </button>

          {/* Floating visual responsive button to buy */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (product.isAvailable) {
                onAddToCart(product);
              }
            }}
            disabled={!product.isAvailable}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-blue-primary/20 bg-blue-primary/10 text-blue-primary shadow-[0_0_12px_rgba(30,61,255,0.1)] transition-all duration-300 hover:border-blue-primary hover:bg-blue-primary hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-600 sm:h-9 sm:w-9 sm:rounded-xl md:h-10 md:w-10"
            title={product.isAvailable ? 'Adicionar ao carrinho' : 'Produto esgotado'}
            aria-label={product.isAvailable ? 'Adicionar ao carrinho' : 'Produto esgotado'}
          >
            <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
