import { ArrowUpRight, Building2 } from 'lucide-react';

const companies = [
  {
    name: 'GG Drones Pulverização',
    description: 'Serviços agrícolas com drones',
    logo: '/brand/gg-group/gg-drones-pulverizacao.png',
    href: 'https://www.ggdronespulverizacao.com.br/',
    action: 'Conhecer serviços',
    accent: 'from-[#67c84d] to-[#17b9ca]',
  },
  {
    name: 'GG Drones Assistência',
    description: 'Assistência técnica especializada',
    logo: '/brand/gg-group/gg-drones-assistencia.png',
    href: 'https://www.instagram.com/ggdroneparts/',
    action: 'Ver Instagram',
    accent: 'from-[#65c84c] to-[#39a62c]',
  },
  {
    name: 'Brasil Drones & Parts',
    description: 'Peças e drones novos',
    logo: '/brand/gg-group/brasil-drones-parts.png',
    accent: 'from-[#1e3dff] to-[#18b6d8]',
  },
] as const;

export default function GGGroupCompanies() {
  return (
    <section
      id="gg-group"
      className="relative overflow-hidden px-4 py-16 md:px-8 md:py-24"
      aria-labelledby="gg-group-title"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(30,61,255,0.14),transparent_42%)]" />
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
            <Building2 className="h-3.5 w-3.5" />
            GG Group
          </div>
          <h2
            id="gg-group-title"
            className="mt-5 font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl"
          >
            Conheça as empresas do Grupo GG
          </h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted sm:text-base">
            Soluções integradas para operação, assistência e tecnologia em drones.
          </p>
        </div>

        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
          {companies.map((company) => (
            <article
              key={company.name}
              className="group relative flex min-h-[240px] w-[78vw] max-w-[310px] shrink-0 snap-start flex-col rounded-2xl border border-white/10 bg-[#0D111A]/85 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-white/20 md:min-h-[280px] md:w-auto md:max-w-none md:p-5"
            >
              <div
                className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${company.accent}`}
              />
              <div className="flex min-h-24 items-center justify-center rounded-xl border border-white bg-white p-4 shadow-inner shadow-black/10 md:min-h-28">
                <img
                  src={company.logo}
                  alt={company.name}
                  className="h-auto max-h-16 w-full max-w-[220px] object-contain md:max-h-20"
                  loading="lazy"
                />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-[-0.03em] text-white md:text-xl">
                {company.name}
              </h3>
              <p className="mt-2 text-sm text-brand-muted">{company.description}</p>
              <div className="mt-auto pt-4">
                {'href' in company ? (
                  <a
                    href={company.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-primary"
                  >
                    {company.action}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-lg bg-blue-primary px-4 py-2.5 text-sm font-semibold text-white">
                    Você está aqui
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
