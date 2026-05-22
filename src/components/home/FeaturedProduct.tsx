import React, { useState } from 'react';
import { ShoppingCart, Heart, ArrowRight, Camera, Battery, Wifi, Shield } from 'lucide-react';
import bgImage from '../../assets/images/mavic_featured_bg_v2_1779247771069.png';

interface FeaturedProductProps {
  onProductClick: (productId: string) => void;
  onAddToCart: (productId: string) => void;
}

export default function FeaturedProduct({ onProductClick, onAddToCart }: FeaturedProductProps) {
  const [favorite, setFavorite] = useState(false);

  const specHighlights = [
    {
      icon: <Camera className="w-5 h-5 text-blue-primary" />,
      label: 'Câmera',
      val: 'Hasselblad 4/3 CMOS',
    },
    {
      icon: <Battery className="w-5 h-5 text-green-accent" />,
      label: 'Autonomia',
      val: 'até 46 min',
    },
    {
      icon: <Wifi className="w-5 h-5 text-blue-primary" />,
      label: 'Transmissão',
      val: '15 km',
    },
    {
      icon: <Shield className="w-5 h-5 text-green-accent" />,
      label: 'Detecção',
      val: '360°',
    },
  ];

  return (
    <section className="w-full px-4 md:px-8 py-16 bg-transparent relative z-20" id="destaque">
      <div className="max-w-7xl mx-auto h-auto min-h-[520px] lg:min-h-[580px] rounded-[32px] border border-white/10 relative overflow-hidden flex flex-col justify-between p-8 md:p-12 lg:p-14 group">
        
        {/* Background Premium Banner image using the newly generated asset */}
        <div 
          className="absolute inset-0 bg-cover bg-right md:bg-[right_10%_center] select-none transition-transform duration-1000 group-hover:scale-[1.01] -z-20"
          style={{ backgroundImage: `url(${bgImage})` }}
          role="img"
          aria-label="DJI Mavic 3 Pro Destaque"
        ></div>

        {/* Ambient Overlay: Darker gradient on the left, fade to transparent/glow on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#03060E] via-[#03060E]/94 to-transparent max-md:from-black/95 max-md:via-black/90 max-md:to-black/80 -z-10"></div>
        
        {/* Absolute glowing aesthetic grid layout on the left */}
        <div className="absolute top-0 left-0 w-1/3 h-full opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none -z-10"></div>

        {/* Top & Mid: Copy texts and primary interaction layouts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10 w-full mb-8 lg:mb-4">
          
          {/* Content side (taking 6 columns) */}
          <div className="lg:col-span-7 flex flex-col text-left gap-5">
            
            {/* Tech Pill Header Badge */}
            <div className="self-start">
              <span className="inline-flex items-center bg-blue-primary/10 border border-blue-primary/30 rounded-full py-1 px-4 text-[10px] font-bold tracking-[0.2em] text-blue-primary uppercase shadow-[0_0_15px_rgba(30,61,255,0.2)]">
                PRODUTO EM DESTAQUE
              </span>
            </div>

            {/* Core Titles */}
            <div className="flex flex-col gap-1.5 mt-1">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#F5F7FA] font-display">
                DJI Mavic 3 Pro
              </h2>
              <p className="text-sm md:text-base font-medium text-brand-muted tracking-tight leading-relaxed">
                Câmera tripla Hasselblad. Performance incomparável.
              </p>
              <p className="text-xs md:text-sm text-brand-muted max-w-lg mt-1 leading-relaxed opacity-85">
                Criado para capturar imagens profissionais com estabilidade absoluta, alcance longo e precisão cirúrgica de gravação.
              </p>
            </div>

            {/* Pricing Area styled like Image 2 */}
            <div className="flex flex-col mt-2 md:mt-4">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#00E676] font-sans">
                R$ 12.999,00
              </span>
              <span className="text-xs text-brand-muted mt-0.5">
                12x de R$ 1.083,25 sem juros
              </span>
            </div>

            {/* Actions Buttons deck (Comprar agora + Wishlist heart toggler) */}
            <div className="flex items-center gap-4 mt-4">
              
              {/* Comprar agora CTA CTA button */}
              <button
                onClick={() => onAddToCart('dji-mavic-3-pro')}
                className="h-11 sm:h-12 px-6 rounded-full text-xs font-semibold tracking-wide text-white bg-blue-primary hover:bg-blue-primary/95 flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_10px_20px_rgba(30,61,255,0.25)] active:scale-[0.98] cursor-pointer max-md:flex-1"
              >
                Comprar agora
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>

              {/* Heart Switch button */}
              <button
                onClick={() => setFavorite(!favorite)}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                  favorite
                    ? 'bg-red-500/15 border-red-500/30 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'border-white/10 bg-black/40 text-brand-white hover:border-white/20 hover:text-white hover:scale-105'
                }`}
                title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Heart className={`w-4 h-4 ${favorite ? 'fill-red-500' : ''}`} />
              </button>

            </div>

          </div>

          {/* Spacer layout */}
          <div className="hidden lg:block lg:col-span-5"></div>

        </div>

        {/* Bottom Horizontal Specification Highlights Bar */}
        <div className="w-full relative z-10 pt-8 mt-auto border-t border-white/5 flex flex-wrap md:flex-nowrap items-center justify-between gap-6 overflow-x-auto scrollbar-none">
          {specHighlights.map((spec, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3.5 flex-1 min-w-[140px] md:min-w-0"
              onClick={() => onProductClick('dji-mavic-3-pro')}
            >
              {/* Spec Icon container circle */}
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] shrink-0">
                {spec.icon}
              </div>

              {/* Spec texts stack vertical structure */}
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-brand-muted uppercase tracking-wider font-display font-medium leading-none mb-1">
                  {spec.label}
                </span>
                <span className="text-xs sm:text-[13px] font-bold text-[#F5F7FA] font-sans truncate max-w-[140px] leading-tight">
                  {spec.val}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
