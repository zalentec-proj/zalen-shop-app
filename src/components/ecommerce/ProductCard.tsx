import React, { useState } from 'react';
import { ShoppingCart, Heart, Eye } from 'lucide-react';
import { Product } from '../../types';

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
    <div className="group glass-panel rounded-[24px] overflow-hidden flex flex-col justify-between transition-all duration-500 hover:border-white/20 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.55)] relative">
      
      {/* Decorative inner background pulse for tech feeling */}
      <div className="absolute inset-0 bg-[#070B14]/40 -z-10 group-hover:bg-[#091021]/50 transition-colors"></div>

      {/* Product Image Stage (Moves to the very top, full edge-to-edge, with premium background layout) */}
      <div
        onClick={() => onProductClick(product.id)}
        className="w-full h-52 relative cursor-pointer overflow-hidden bg-gradient-to-b from-white/[0.04] via-transparent to-transparent border-b border-brand-border-soft flex items-center justify-center p-0"
      >
        {/* Absolute Badges on top of image */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 pointer-events-none">
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
          className={`absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            favorite
              ? 'bg-red-500/15 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
              : 'border-white/10 bg-black/40 text-brand-white hover:border-white/20 hover:text-white hover:scale-105'
          }`}
        >
          <Heart className={`w-4 h-4 ${favorite ? 'fill-red-500' : ''}`} />
        </button>

        {/* Drone Image: Perfectly balanced space sizing taking up the full area optimally */}
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover filter group-hover:scale-110 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-all duration-500 select-none pointer-events-none z-10"
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
      <div className="p-6 pt-2 flex flex-col text-left gap-3 relative">
        <div className="flex flex-col gap-1 cursor-pointer" onClick={() => onProductClick(product.id)}>
          {/* Category breadcrumb */}
          <span className="text-[10px] font-bold tracking-widest text-brand-muted uppercase font-display">
            {product.category}
          </span>
          <h3 className="text-[15px] font-bold text-white tracking-tight line-clamp-1 group-hover:text-blue-primary transition-colors">
            {product.name}
          </h3>
        </div>

        {/* Pricing Layout */}
        <div className="flex flex-col gap-0.5">
          {/* Installments in gray (discrete) */}
          <span className="text-[11px] text-brand-muted">
            12x de R$ {monthlyInstallment} sem juros
          </span>
          {/* Large green-accent price */}
          <span className="text-lg font-extrabold text-green-accent font-sans">
            R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Quick add triggers */}
        <div className="flex items-center justify-between pt-3 border-t border-brand-border-soft mt-1">
          <button
            onClick={() => onProductClick(product.id)}
            className="text-xs font-semibold text-brand-white group-hover:text-blue-primary transition-colors cursor-pointer"
          >
            Ver detalhes
          </button>

          {/* Floating visual responsive button to buy */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="w-10 h-10 rounded-xl bg-blue-primary/10 border border-blue-primary/20 text-blue-primary hover:bg-blue-primary hover:text-white transition-all duration-300 flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(30,61,255,0.1)] active:scale-95 hover:border-blue-primary"
            title="Adicionar ao carrinho"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
