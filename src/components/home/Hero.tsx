import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Battery,
  Camera,
  Handshake,
  PackageCheck,
  Shield,
  Truck,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import Logo from '../ui/Logo';
import brandBgAsset from '../../assets/images/mavic_featured_bg_v2_1779247771069.png';
import freightPromoBgAsset from '../../assets/images/hero_frete_promocional_brasil_drones_20260708.png';
import technicianBgAsset from '../../assets/images/hero_tecnicos_assistencias_brasil_drones_20260708.png';

interface HeroProps {
  onExploreClick: () => void;
  onPeasClick: () => void;
}

type HeroSlide = {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  backgroundImage: string;
  backgroundPosition: string;
  align: 'left' | 'center' | 'split';
  primaryCta: {
    label: string;
    action: 'explore' | 'contact';
  };
  secondaryCta?: {
    label: string;
    action: 'parts' | 'contact';
  };
  detailCards?: Array<{
    label: string;
    value: string;
    icon: React.ReactNode;
    colorClass: string;
  }>;
  partnerBullets?: Array<{
    label: string;
    icon: React.ReactNode;
  }>;
};

const slides: HeroSlide[] = [
  {
    id: 'brand',
    eyebrow: 'TECNOLOGIA QUE ELEVA',
    title: (
      <>
        Drones de alta <br />
        performance <br />
        para{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-primary to-[#00D4FF] font-bold">
          ir além.
        </span>
      </>
    ),
    description:
      'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.',
    backgroundImage: brandBgAsset.src,
    backgroundPosition: '42% 50%',
    align: 'left',
    primaryCta: {
      label: 'Comprar agora',
      action: 'explore',
    },
    secondaryCta: {
      label: 'Ver peças',
      action: 'parts',
    },
    detailCards: [
      {
        label: 'Transmissão',
        value: '15 km',
        icon: <Wifi className="h-5 w-5 text-cyan-400" />,
        colorClass: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
      },
      {
        label: 'Autonomia',
        value: 'até 46 min',
        icon: <Battery className="h-5 w-5 text-[#00E676]" />,
        colorClass: 'text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20',
      },
      {
        label: 'Detecção',
        value: '360°',
        icon: <Shield className="h-5 w-5 text-[#00D4FF]" />,
        colorClass: 'text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/20',
      },
      {
        label: 'Câmera Hasselblad',
        value: '4/3 CMOS',
        icon: <Camera className="h-5 w-5 text-emerald-400" />,
        colorClass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      },
    ],
  },
  {
    id: 'freight-promo',
    eyebrow: 'OFERTA ESPECIAL',
    title: (
      <>
        <span className="block text-[#8FDFFF] drop-shadow-[0_0_24px_rgba(0,212,255,0.45)]">
          50% OFF
        </span>
        no frete para compras <br />
        acima de R$300,00
      </>
    ),
    description: '*Apenas para Correios',
    backgroundImage: freightPromoBgAsset.src,
    backgroundPosition: 'center',
    align: 'center',
    primaryCta: {
      label: 'Comprar agora',
      action: 'explore',
    },
    secondaryCta: {
      label: 'Ver categorias',
      action: 'parts',
    },
    partnerBullets: [
      { label: 'Peças originais', icon: <PackageCheck className="h-4 w-4" /> },
      { label: 'Envio rápido', icon: <Truck className="h-4 w-4" /> },
      { label: 'Compra segura', icon: <Shield className="h-4 w-4" /> },
    ],
  },
  {
    id: 'technicians',
    eyebrow: 'PARCEIROS E ASSISTÊNCIAS',
    title: (
      <>
        Condições especiais <br />
        para técnicos e <br />
        assistências
      </>
    ),
    description:
      'Seja um parceiro Brasil Drones e conte com peças selecionadas, garantia e suporte para manter sua operação em movimento.',
    backgroundImage: technicianBgAsset.src,
    backgroundPosition: 'center',
    align: 'split',
    primaryCta: {
      label: 'Saiba mais',
      action: 'contact',
    },
    secondaryCta: {
      label: 'Ver peças',
      action: 'parts',
    },
    partnerBullets: [
      { label: 'Peças de qualidade com garantia', icon: <Wrench className="h-4 w-4" /> },
      { label: 'Descontos especiais e envio rápido', icon: <Zap className="h-4 w-4" /> },
      { label: 'Atendimento para parceiros', icon: <Handshake className="h-4 w-4" /> },
    ],
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Hero({ onExploreClick, onPeasClick }: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activeBackgrounds = useMemo(() => {
    return slides.map((slide) => ({
      id: slide.id,
      src: slide.backgroundImage,
      position: slide.backgroundPosition,
    }));
  }, []);

  const handleAction = (action: 'explore' | 'parts' | 'contact') => {
    if (action === 'explore') {
      onExploreClick();
      return;
    }

    if (action === 'parts') {
      onPeasClick();
      return;
    }

    const contactSection = document.getElementById('contato');

    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[#03060d] pb-14 pt-44 lg:pb-14 lg:pt-44"
      id="home"
      aria-label="Destaques Brasil Drones"
    >
      <div className="absolute inset-0 z-0 h-full w-full select-none overflow-hidden pointer-events-none">
        {activeBackgrounds.map((background, index) => (
          <div
            key={background.id}
            className={cn(
              'absolute inset-0 h-full w-full bg-cover transition-opacity duration-700 ease-out',
              index === activeIndex ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              backgroundImage: `url(${background.src})`,
              backgroundPosition: background.position,
            }}
            role="img"
            aria-label="Fundo promocional Brasil Drones"
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-[#03060e] via-[#03060e]/55 to-[#03060e]/15 max-md:from-[#03060e]/95 max-md:via-[#03060e]/82 max-md:to-[#03060e]/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03060d] via-transparent to-[#03060d]/25" />
      </div>

      <div className="relative z-10 mx-auto mt-4 w-full max-w-7xl px-6 md:px-12 lg:mt-0">
        <div
          className={cn(
            'grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12',
            activeSlide.align === 'center' && 'text-center',
            activeSlide.align === 'split' && 'xl:items-center'
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-4',
              activeSlide.align === 'center'
                ? 'lg:col-span-12 mx-auto max-w-4xl items-center text-center'
                : 'lg:col-span-12 xl:col-span-7 items-start text-left'
            )}
          >
            <div className="mb-1 inline-flex items-center rounded-full border border-[#00E676]/30 bg-[#072415]/60 px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#00E676] backdrop-blur-md md:text-xs">
              {activeSlide.eyebrow}
            </div>

            {activeSlide.id !== 'brand' ? (
              <Logo
                size="sm"
                className={cn(
                  'mb-1 h-[38px] drop-shadow-[0_0_18px_rgba(0,212,255,0.2)]',
                  activeSlide.align === 'center' && 'mx-auto'
                )}
              />
            ) : null}

            <h1
              className={cn(
                'max-w-4xl select-none font-display text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-[48px] lg:leading-[1.08] xl:text-[64px]',
                activeSlide.id === 'freight-promo' && 'uppercase',
                activeSlide.align === 'center' && 'mx-auto'
              )}
            >
              {activeSlide.title}
            </h1>

            <p
              className={cn(
                'max-w-xl text-xs leading-relaxed text-brand-muted opacity-90 sm:text-sm',
                activeSlide.align === 'center' && 'mx-auto text-center',
                activeSlide.id === 'freight-promo' && 'text-white/80'
              )}
            >
              {activeSlide.description}
            </p>

            <div
              className={cn(
                'mt-4 flex w-full flex-wrap items-center gap-4 sm:w-auto',
                activeSlide.align === 'center' && 'justify-center'
              )}
            >
              <button
                onClick={() => handleAction(activeSlide.primaryCta.action)}
                className="group flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-primary px-8 text-xs font-semibold tracking-wide text-white shadow-[0_8px_24px_rgba(30,61,255,0.3)] transition-all duration-300 hover:scale-[1.02] hover:bg-blue-primary/95 sm:flex-initial md:text-sm"
              >
                {activeSlide.primaryCta.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              {activeSlide.secondaryCta ? (
                <button
                  onClick={() => handleAction(activeSlide.secondaryCta!.action)}
                  className="group flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-8 text-xs font-semibold tracking-wide text-white transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.04] sm:flex-initial md:text-sm"
                >
                  {activeSlide.secondaryCta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              'lg:col-span-12 xl:col-span-5 mt-6 flex w-full xl:mt-0',
              activeSlide.align === 'center'
                ? 'justify-center'
                : 'justify-start xl:justify-end'
            )}
          >
            {activeSlide.detailCards ? (
              <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 xl:max-w-[280px] xl:grid-cols-1">
                {activeSlide.detailCards.map((spec) => (
                  <div
                    key={spec.label}
                    className="group/spec flex items-center gap-4 rounded-2xl border border-white/5 bg-black/30 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 group-hover/spec:scale-105 ${spec.colorClass}`}
                    >
                      {spec.icon}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[12px] font-medium tracking-wide text-[#8F9CAE]">
                        {spec.label}
                      </span>
                      <span className="mt-0.5 text-[14px] font-bold tracking-tight text-white">
                        {spec.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeSlide.partnerBullets ? (
              <div className="grid w-full max-w-xl gap-3 sm:grid-cols-3 xl:max-w-[360px] xl:grid-cols-1">
                {activeSlide.partnerBullets.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl border border-[#00D4FF]/30 bg-black/35 px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-white shadow-[0_12px_34px_rgba(0,0,0,0.45)] backdrop-blur-md"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#00D4FF]/25 bg-[#00D4FF]/10 text-[#8FDFFF]">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 lg:bottom-8">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Mostrar destaque ${index + 1}`}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                index === activeIndex
                  ? 'w-8 bg-blue-primary shadow-[0_0_12px_rgba(30,61,255,0.65)]'
                  : 'w-2 bg-white/30 hover:bg-white/55'
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
