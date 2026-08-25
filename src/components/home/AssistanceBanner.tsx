import Image from 'next/image';
import { ArrowUpRight, MapPin, Wrench } from 'lucide-react';

const GG_ASSISTENCIA_URL = 'https://www.instagram.com/ggdroneparts/';

export default function AssistanceBanner() {
  return (
    <section
      className="px-3 pb-12 pt-4 md:px-8 md:pb-20 md:pt-8"
      aria-labelledby="assistance-banner-title"
    >
      <div className="relative isolate mx-auto min-h-[390px] max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[#030a10] shadow-[0_28px_90px_rgba(0,0,0,0.42)] sm:min-h-[420px] lg:min-h-[450px]">
        <Image
          src="/brand/home/gg-assistencia-repair-banner.webp"
          alt=""
          fill
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="object-cover object-[70%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,13,0.99)_0%,rgba(2,8,13,0.94)_38%,rgba(2,8,13,0.48)_68%,rgba(2,8,13,0.12)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_40%,rgba(16,185,129,0.13),transparent_35%)]" />

        <div className="relative z-10 flex min-h-[390px] items-center px-5 py-8 sm:min-h-[420px] sm:px-8 lg:min-h-[450px] lg:px-12">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 sm:text-xs">
              <Wrench className="h-3.5 w-3.5" />
              GG Assistência
            </div>

            <h2
              id="assistance-banner-title"
              className="mt-5 max-w-lg font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.045em] text-white sm:text-4xl lg:text-5xl"
            >
              Precisa de{' '}
              <span className="text-emerald-400">assistência técnica?</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              Conheça a GG Assistência, nossa empresa especializada em drones,
              com atendimento para todo o Brasil.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={GG_ASSISTENCIA_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-[#04110d] shadow-[0_12px_35px_rgba(52,211,153,0.22)] transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
              >
                Conheça agora
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 sm:text-sm">
                <MapPin className="h-4 w-4 text-emerald-400" />
                Atendimento nacional
              </span>
            </div>

            <div className="mt-6 flex max-w-[340px] items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.94] px-4 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.3)] backdrop-blur">
              <Image
                src="/brand/gg-group/gg-drones-assistencia.png"
                alt="GG Drones Assistência"
                width={500}
                height={188}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
