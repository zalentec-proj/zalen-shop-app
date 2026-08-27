import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Handshake,
  PackageCheck,
  Shield,
  Truck,
  Wrench,
  Zap,
} from 'lucide-react';
import Logo from '../ui/Logo';
import djiLogoAsset from '../../assets/dji-logo.svg';
import brandBgAsset from '../../assets/images/mavic_featured_bg_v2_1779247771069.png';
import freightPromoBgAsset from '../../assets/images/hero_frete_promocional_brasil_drones_20260708.png';
import technicianBgAsset from '../../assets/images/hero_tecnicos_assistencias_brasil_drones_20260708.png';

interface HeroProps {
  onExploreClick: () => void;
  onPeasClick: () => void;
  hasTopNotice?: boolean;
}

type HeroSlide = {
  id: string;
  title: React.ReactNode;
  description: string;
  backgroundImage: string;
  backgroundPosition: string;
  align: 'left' | 'center' | 'split';
  primaryCta:
    | {
        kind: 'action';
        label: string;
        action: 'explore' | 'contact';
      }
    | {
        kind: 'link';
        label: string;
        href: string;
      };
  secondaryCta?: {
    label: string;
    action: 'parts' | 'contact';
  };
  brandEndorsement?: {
    logoSrc?: string;
    logoAlt?: string;
    logoClassName?: string;
    title: string;
    description: React.ReactNode;
  };
  showStoreLogo?: boolean;
  partnerBullets?: Array<{
    label: string;
    icon: React.ReactNode;
  }>;
};

type StaticAsset = string | { src: string };

const djiLogo = typeof (djiLogoAsset as StaticAsset) === 'string'
  ? djiLogoAsset
  : (djiLogoAsset as { src: string }).src;

const slides: HeroSlide[] = [
  {
    id: 'brand',
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
      kind: 'action',
      label: 'Comprar agora',
      action: 'explore',
    },
    secondaryCta: {
      label: 'Ver peças',
      action: 'parts',
    },
    brandEndorsement: {
      title: 'Autorizada DJI',
      description: (
        <>
          Drones e peças <span className="text-[#00E676]">DJI</span> originais
        </>
      ),
    },
  },
  {
    id: 'freight-promo',
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
      kind: 'action',
      label: 'Comprar agora',
      action: 'explore',
    },
    secondaryCta: {
      label: 'Ver categorias',
      action: 'parts',
    },
    showStoreLogo: true,
    partnerBullets: [
      { label: 'Peças originais', icon: <PackageCheck className="h-4 w-4" /> },
      { label: 'Envio rápido', icon: <Truck className="h-4 w-4" /> },
      { label: 'Compra segura', icon: <Shield className="h-4 w-4" /> },
    ],
  },
  {
    id: 'technicians',
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
      kind: 'action',
      label: 'Saiba mais',
      action: 'contact',
    },
    secondaryCta: {
      label: 'Ver peças',
      action: 'parts',
    },
    showStoreLogo: true,
    partnerBullets: [
      { label: 'Peças de qualidade com garantia', icon: <Wrench className="h-4 w-4" /> },
      { label: 'Descontos especiais e envio rápido', icon: <Zap className="h-4 w-4" /> },
      { label: 'Atendimento para parceiros', icon: <Handshake className="h-4 w-4" /> },
    ],
  },
  {
    id: 'assistance',
    title: (
      <>
        Precisa de{' '}
        <span className="text-emerald-400">assistência técnica?</span>
      </>
    ),
    description:
      'Conheça a GG Assistência, nossa empresa especializada em drones, com atendimento para todo o Brasil.',
    backgroundImage: '/brand/home/gg-assistencia-repair-banner.webp',
    backgroundPosition: '70% center',
    align: 'split',
    primaryCta: {
      kind: 'link',
      label: 'Conheça agora',
      href: 'https://www.instagram.com/ggdroneparts/',
    },
    secondaryCta: {
      label: 'Ver peças',
      action: 'parts',
    },
    brandEndorsement: {
      logoSrc: '/brand/gg-group/gg-drones-assistencia.png',
      logoAlt: 'GG Drones Assistência',
      logoClassName: 'max-w-[420px] brightness-0 invert',
      title: 'Atendimento nacional',
      description: 'Assistência especializada em drones',
    },
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Hero({
  onExploreClick,
  onPeasClick,
  hasTopNotice = false,
}: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] ?? slides[0];
  const primaryCta = activeSlide.primaryCta;

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
      className={cn(
        'relative flex w-full items-center justify-center overflow-hidden bg-[#03060d] px-0 pb-10 sm:pb-12',
        hasTopNotice
          ? 'min-h-[clamp(720px,100svh,840px)] pt-48 sm:pt-52 md:pt-56 xl:pt-60'
          : 'min-h-[clamp(680px,100svh,820px)] pt-28 md:pt-32 xl:pt-40'
      )}
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

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 md:px-10 xl:px-8">
        <div
          className={cn(
            'grid grid-cols-1 items-center gap-7 lg:grid-cols-12 xl:gap-10',
            activeSlide.align === 'center' && 'text-center',
            activeSlide.align === 'split' && 'xl:items-center'
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-3.5',
              activeSlide.align === 'center'
                ? 'mx-auto max-w-3xl items-center text-center lg:col-span-12'
                : 'lg:col-span-12 xl:col-span-7 items-start text-left'
            )}
          >
            {activeSlide.showStoreLogo ? (
              <Logo
                size="sm"
                className={cn(
                  'h-[42px] drop-shadow-[0_0_18px_rgba(0,212,255,0.25)]',
                  activeSlide.align === 'center' && 'mx-auto'
                )}
              />
            ) : null}

            <h1
              className={cn(
                'max-w-4xl select-none font-display text-4xl font-black leading-[1.08] tracking-tight text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.7)] sm:text-5xl lg:text-[52px] xl:text-[60px]',
                activeSlide.id === 'freight-promo' && 'uppercase',
                activeSlide.align === 'center' && 'mx-auto'
              )}
            >
              {activeSlide.title}
            </h1>

            <p
              className={cn(
                'max-w-xl text-sm leading-6 text-slate-200 drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] sm:text-base sm:leading-7',
                activeSlide.align === 'center' && 'mx-auto text-center',
                activeSlide.id === 'freight-promo' && 'font-medium text-white/90'
              )}
            >
              {activeSlide.description}
            </p>

            <div
              className={cn(
                'mt-2 flex w-full flex-wrap items-center gap-3 sm:w-auto',
                activeSlide.align === 'center' && 'justify-center'
              )}
            >
              {primaryCta.kind === 'link' ? (
                <a
                  href={primaryCta.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-400 px-8 text-xs font-semibold tracking-wide text-[#04110d] shadow-[0_8px_24px_rgba(52,211,153,0.25)] transition-all duration-300 hover:scale-[1.02] hover:bg-emerald-300 sm:flex-initial md:text-sm"
                >
                  {primaryCta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : (
                <button
                  onClick={() => handleAction(primaryCta.action)}
                  className="group flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-primary px-8 text-xs font-semibold tracking-wide text-white shadow-[0_8px_24px_rgba(30,61,255,0.3)] transition-all duration-300 hover:scale-[1.02] hover:bg-blue-primary/95 sm:flex-initial md:text-sm"
                >
                  {primaryCta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

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
              'mt-2 flex w-full',
              activeSlide.align === 'center'
                ? 'justify-center lg:col-span-12'
                : 'justify-start lg:col-span-12 xl:col-span-5 xl:mt-0 xl:justify-end'
            )}
          >
            {activeSlide.brandEndorsement ? (
              <div className="flex w-full max-w-xl flex-col items-center text-center xl:max-w-[640px]">
                <img
                  src={activeSlide.brandEndorsement.logoSrc ?? djiLogo}
                  alt={activeSlide.brandEndorsement.logoAlt ?? 'DJI'}
                  className={cn(
                    'h-auto w-full object-contain drop-shadow-[0_18px_38px_rgba(0,0,0,0.34)]',
                    activeSlide.brandEndorsement.logoClassName ??
                      'max-w-[560px] brightness-0 invert'
                  )}
                  draggable={false}
                />
                <p className="mt-5 text-lg font-bold tracking-tight text-white sm:text-xl">
                  {activeSlide.brandEndorsement.title}
                </p>
                <p className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                  {activeSlide.brandEndorsement.description}
                </p>
              </div>
            ) : null}

            {activeSlide.partnerBullets ? (
              <div
                className={cn(
                  'grid w-full gap-3',
                  activeSlide.align === 'center'
                    ? 'max-w-4xl sm:grid-cols-3'
                    : 'max-w-xl sm:grid-cols-3 xl:max-w-[360px] xl:grid-cols-1'
                )}
              >
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

      </div>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
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
    </section>
  );
}
