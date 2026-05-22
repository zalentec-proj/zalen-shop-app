import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Logo from '../ui/Logo';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="w-full relative bg-brand-bg/80 border-t border-brand-border-soft overflow-hidden mt-20">
      {/* Decorative cosmic glow */}
      <div className="absolute -bottom-60 left-1/2 -translate-x-1/2 w-[600px] h-[300px] glow-radial pointer-events-none rounded-full blur-3xl opacity-40"></div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
        {/* Brand details */}
        <div className="flex flex-col gap-6">
          <Logo size="sm" />
          <p className="text-[14px] leading-relaxed text-brand-muted font-normal max-w-sm">
            A Brasil Drones & Parts é especializada em drones e peças de alta performance, oferecendo tecnologia, suporte e segurança para elevar seus projetos de mapeamento, filmagem ou inspeção técnica.
          </p>
        </div>

        {/* Categorias links */}
        <div className="flex flex-col gap-4">
          <h4 className="text-[13px] font-bold tracking-widest text-[#F5F7FA] uppercase font-display">
            Categorias
          </h4>
          <ul className="flex flex-col gap-2.5 text-[14px] text-brand-muted">
            <li><Link href="/categoria/drones" className="hover:text-blue-primary transition-colors">Drones</Link></li>
            <li><Link href="/categoria/pecas" className="hover:text-blue-primary transition-colors">Peças e Componentes</Link></li>
            <li><Link href="/categoria/baterias" className="hover:text-blue-primary transition-colors">Baterias</Link></li>
            <li><Link href="/categoria/acessorios" className="hover:text-blue-primary transition-colors">Acessórios</Link></li>
            <li><Link href="/categoria/kits-e-combos" className="hover:text-blue-primary transition-colors">Kits e Combos</Link></li>
          </ul>
        </div>

        {/* Institucional / Ajuda links */}
        <div className="flex flex-col gap-4">
          <h4 className="text-[13px] font-bold tracking-widest text-[#F5F7FA] uppercase font-display">
            Institucional
          </h4>
          <ul className="flex flex-col gap-2.5 text-[14px] text-brand-muted">
            <li><a href="/#tecnologia" className="hover:text-blue-primary transition-colors">Nossa Tecnologia</a></li>
            <li><a href="/#beneficios" className="hover:text-blue-primary transition-colors">Garantia Oficial</a></li>
            <li><a href="/#tecnologia" className="hover:text-blue-primary transition-colors">Suporte Técnico Avançado</a></li>
            <li><a href="/#contato" className="hover:text-blue-primary transition-colors">Termos de Serviço</a></li>
            <li><a href="/#contato" className="hover:text-blue-primary transition-colors">Política de Privacidade</a></li>
          </ul>
        </div>

        {/* Newsletter subscribe */}
        <div className="flex flex-col gap-5">
          <h4 className="text-[13px] font-bold tracking-widest text-[#F5F7FA] uppercase font-display">
            Newsletter
          </h4>
          <p className="text-[13px] text-brand-muted leading-relaxed">
            Receba ofertas exclusivas, novidades e alertas de estoque de peças difíceis diretamente no seu e-mail.
          </p>

          {!subscribed ? (
            <form onSubmit={handleSubscribe} className="relative flex items-center">
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-11 pl-4 pr-12 rounded-xl bg-brand-surface border border-brand-border text-xs focus:outline-none focus:border-blue-primary transition-colors font-sans"
              />
              <button
                type="submit"
                className="absolute right-1 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-primary text-white hover:opacity-90 transition-opacity cursor-pointer shadow-[0_4px_12px_rgba(30,61,255,0.3)]"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-green-accent/10 border border-green-accent/30 text-green-accent text-xs flex items-center justify-center font-medium animate-fade-in">
              Obrigado por se inscrever!
            </div>
          )}
        </div>
      </div>

      {/* Under footer */}
      <div className="w-full border-t border-brand-border-soft bg-black/40 py-8 px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-brand-muted font-normal">
          <span>
            © 2026 Brasil Drones & Parts. Todos os direitos reservados.
          </span>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-accent" /> 100% Seguro</span>
            <span>CNPJ: 00.000.000/0001-00</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
