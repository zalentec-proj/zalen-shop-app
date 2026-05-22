import React from 'react';
import { ArrowRight, Wifi, Battery, Shield, Camera } from 'lucide-react';
import bgImage from '../../assets/images/mavic_featured_bg_v2_1779247771069.png';

interface HeroProps {
  onExploreClick: () => void;
  onPeasClick: () => void;
}

export default function Hero({ onExploreClick, onPeasClick }: HeroProps) {
  const rightSpecs = [
    {
      label: 'Transmissão',
      value: '15 km',
      icon: <Wifi className="w-5 h-5 text-cyan-400" />,
      colorClass: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
    },
    {
      label: 'Autonomia',
      value: 'até 46 min',
      icon: <Battery className="w-5 h-5 text-[#00E676]" />,
      colorClass: 'text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20'
    },
    {
      label: 'Detecção',
      value: '360°',
      icon: <Shield className="w-5 h-5 text-[#00D4FF]" />,
      colorClass: 'text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/20'
    },
    {
      label: 'Câmera Hasselblad',
      value: '4/3 CMOS',
      icon: <Camera className="w-5 h-5 text-emerald-400" />,
      colorClass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    }
  ];

  return (
    <section 
      className="relative w-full min-h-[100vh] flex items-center justify-center overflow-hidden bg-[#03060d] pt-24 pb-12 lg:py-0"
      id="home"
    >
      {/* Background Image - Luminous and completely unblocked */}
      <div className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0">
        <div 
          className="w-full h-full bg-cover bg-[42%_50%] lg:bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
          role="img"
          aria-label="DJI Mavic 3 Pro"
        ></div>
        
        {/* Soft atmospheric gradient highlights to preserve absolute readability of text on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#03060e] via-[#03060e]/50 to-transparent max-md:from-[#03060e]/95 max-md:via-[#03060e]/80 max-md:to-[#03060e]/40"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#03060d] via-transparent to-[#03060d]/30"></div>
      </div>

      {/* Hero Content Area */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 mt-6 lg:mt-0">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column Content */}
          <div className="lg:col-span-12 xl:col-span-7 flex flex-col text-left items-start gap-4">
            
            {/* Tag Badge */}
            <div className="inline-flex items-center bg-[#072415]/60 backdrop-blur-md border border-[#00E676]/30 rounded-full px-3.5 py-1 text-[10px] md:text-xs font-bold tracking-[0.16em] text-[#00E676] uppercase font-mono mb-1">
              TECNOLOGIA QUE ELEVA
            </div>

            {/* Title with Gradient Accent */}
            <h1 className="text-3xl sm:text-5xl lg:text-[44px] xl:text-[54px] lg:leading-[1.12] font-black tracking-tight text-white font-display select-none">
              Drones de alta <br />
              performance <br />
              para <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-primary to-[#00D4FF] font-bold">ir além.</span>
            </h1>

            {/* Description Paragraph */}
            <p className="text-xs sm:text-sm text-brand-muted max-w-md leading-relaxed font-normal opacity-90">
              Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.
            </p>

            {/* CTA double button deck exactly like Image 2 */}
            <div className="flex flex-wrap items-center gap-4 mt-4 w-full sm:w-auto">
              <button
                onClick={onExploreClick}
                className="px-8 h-12 rounded-lg text-xs md:text-sm font-semibold tracking-wide text-white bg-blue-primary hover:bg-blue-primary/95 flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_8px_24px_rgba(30,61,255,0.3)] hover:scale-[1.02] cursor-pointer group flex-1 sm:flex-initial"
              >
                Comprar agora
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              
              <button
                onClick={onPeasClick}
                className="px-8 h-12 rounded-lg text-xs md:text-sm font-semibold tracking-wide text-white bg-transparent border border-white/10 hover:bg-white/[0.04] hover:border-white/20 flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer group flex-1 sm:flex-initial"
              >
                Ver peças
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

          </div>

          {/* Right Column Specifications Overlay Card Stack */}
          <div className="lg:col-span-12 xl:col-span-5 flex justify-start xl:justify-end w-full mt-6 xl:mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 xl:flex xl:flex-col gap-3 w-full max-w-4xl xl:max-w-[280px]">
              {rightSpecs.map((spec, idx) => (
                <div
                  key={idx}
                  className="bg-black/30 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300 shadow-[0_12px_40px_rgba(0,0,0,0.6)] group/spec"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 group-hover/spec:scale-105 ${spec.colorClass}`}>
                    {spec.icon}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[12px] text-[#8F9CAE] tracking-wide font-medium">
                      {spec.label}
                    </span>
                    <span className="text-[14px] font-bold text-white tracking-tight mt-0.5">
                      {spec.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
