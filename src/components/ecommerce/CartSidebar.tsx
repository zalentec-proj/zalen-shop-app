import React from 'react';
import { X, Trash2, ShieldCheck, ShoppingBag, ArrowRight } from 'lucide-react';
import type { Cart } from '@/modules/cart/cart.types';
import { getItemCount } from '@/modules/cart/cart.utils';
import { SafeCatalogImage } from '@/components/ui/SafeCatalogImage';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Cart;
  onUpdateQuantity: (productId: string, variantId: string, qty: number) => void;
  onRemoveItem: (productId: string, variantId: string) => void;
  onCheckout: () => void;
}

export default function CartSidebar({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: CartSidebarProps) {
  if (!isOpen) return null;

  const itemCount = getItemCount(cart);
  const subtotal = cart.subtotal;
  const total = subtotal;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-300">
      
      {/* Backdrop glass overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#05070B]/70 backdrop-blur-md cursor-pointer"
      ></div>

      {/* Cart Drawer container panel */}
      <div className="relative w-full max-w-md h-full glass-panel-strong border-l border-brand-border/40 p-6 sm:p-8 flex flex-col justify-between shadow-[0_0_80px_rgba(0,0,0,0.85)] z-10 animate-slide-in">
        
        {/* Top Header info */}
        <div className="flex items-center justify-between border-b border-brand-border-soft pb-4">
          <div className="flex flex-col text-left">
            <h2 className="text-xl font-extrabold text-white tracking-tight font-display flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-primary" />
              Seu carrinho
            </h2>
            <span className="text-[11px] font-mono text-brand-muted mt-0.5">
              {itemCount} {itemCount === 1 ? 'item adicionado' : 'itens adicionados'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-white/10 hover:border-white/25 flex items-center justify-center text-[#8A93A3] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list stage scrollbar */}
        <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4">
          {cart.items.length > 0 ? (
            cart.items.map((item) => (
              <div
                key={`${item.productId}-${item.variantId}`}
                className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex gap-4 hover:border-white/10 transition-colors relative"
              >
                {/* Product thumbnail */}
                <div className="w-16 h-16 rounded-xl bg-white/[0.02] border border-white/5 p-1 flex items-center justify-center shrink-0">
                  <SafeCatalogImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full rounded-xl object-contain drop-shadow"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Text attributes, counts and prices */}
                <div className="flex-1 flex flex-col text-left justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-white tracking-tight line-clamp-1">
                      {item.name}
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-brand-muted">
                      {item.sku ? `SKU: ${item.sku}` : 'Produto Brasil Drones'}
                    </span>
                  </div>

                  {/* Quantity adjusts and values */}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    
                    {/* Controls */}
                    <div className="h-8 bg-white/[0.03] border border-white/10 rounded-lg flex items-center px-1">
                      <button
                        disabled={item.quantity <= 1}
                        onClick={() => onUpdateQuantity(item.productId, item.variantId, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center text-[#8A93A3] hover:text-white transition-colors disabled:opacity-30"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono text-xs text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.productId, item.variantId, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center text-[#8A93A3] hover:text-white transition-colors"
                      >
                        +
                      </button>
                    </div>

                    {/* Green aligned Price */}
                    <span className="text-[13px] font-bold text-green-accent font-sans">
                      R$ {(item.unitPrice * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>

                  </div>
                </div>

                {/* Trash delete button */}
                <button
                  onClick={() => onRemoveItem(item.productId, item.variantId)}
                  className="absolute top-4 right-4 text-brand-muted hover:text-red-500 transition-colors cursor-pointer"
                  title="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

              </div>
            ))
          ) : (
            // Empty state
            <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center text-brand-muted">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="text-[#8A93A3] text-sm">Seu carrinho está vazio.</p>
              <button
                onClick={onClose}
                className="px-6 h-11 bg-blue-primary/20 hover:bg-blue-primary border border-blue-primary/30 text-white rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer"
              >
                Explorar catálogo
              </button>
            </div>
          )}
        </div>

        {/* Bottom checkout blocks */}
        {cart.items.length > 0 && (
          <div className="border-t border-brand-border-soft pt-6 flex flex-col gap-4">
            
            {/* Value computations layout */}
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between text-[#8A93A3]">
                <span>Subtotal:</span>
                <span className="font-mono">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[#8A93A3]">
                <span>Frete:</span>
                <span className="text-green-accent font-semibold uppercase tracking-wider text-xs">Grátis</span>
              </div>
              <div className="h-[1px] bg-brand-border-soft my-1"></div>
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-white font-display">Total:</span>
                <span className="text-xl font-extrabold text-green-accent font-sans">
                  R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Check button */}
            <button
              onClick={onCheckout}
              className="w-full h-14 rounded-full text-sm font-semibold tracking-wide text-white gradient-button relative group flex items-center justify-center gap-2 cursor-pointer shadow-[0_15px_30px_rgba(30,61,255,0.3)] hover:opacity-90 active:scale-95 transition-all"
            >
              FINALIZAR COMPRA
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Security banner */}
            <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl text-left mt-1">
              <ShieldCheck className="w-5 h-5 text-green-accent shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">COMPRA 100% SEGURA</span>
                <span className="text-[10px] text-brand-muted leading-tight">Seus dados protegidos por criptografia SSL militar.</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
