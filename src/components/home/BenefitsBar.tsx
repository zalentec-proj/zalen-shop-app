import React from 'react';
import { ShieldCheck, Truck, CreditCard, Award, Headphones } from 'lucide-react';

export default function BenefitsBar() {
  const benefits = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-blue-primary" />,
      title: 'Compra segura',
      desc: 'Seus dados protegidos',
      glow: 'shadow-[0_0_15px_rgba(30,61,255,0.15)]',
    },
    {
      icon: <Truck className="w-5 h-5 text-green-accent" />,
      title: 'Entrega rápida',
      desc: 'Para todo o Brasil',
      glow: 'shadow-[0_0_15px_rgba(0,230,118,0.15)]',
    },
    {
      icon: <CreditCard className="w-5 h-5 text-blue-primary" />,
      title: 'Parcele em até 12x',
      desc: 'Condições especiais',
      glow: 'shadow-[0_0_15px_rgba(30,61,255,0.1) ]',
    },
    {
      icon: <Award className="w-5 h-5 text-green-accent" />,
      title: 'Garantia oficial',
      desc: 'Produtos com garantia',
      glow: 'shadow-[0_0_15px_rgba(0,230,118,0.1)]',
    },
    {
      icon: <Headphones className="w-5 h-5 text-blue-primary" />,
      title: 'Suporte especializado',
      desc: 'Atendimento técnico',
      glow: 'shadow-[0_0_15px_rgba(30,61,255,0.15)]',
    },
  ];

  return (
    <section id="beneficios" className="w-full px-4 md:px-8 py-8 -mt-2 relative z-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {benefits.map((b, i) => (
          <div
            key={i}
            className={`glass-panel p-5 rounded-3xl flex items-center gap-4 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 ${b.glow}`}
          >
            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0">
              {b.icon}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[13px] font-semibold text-white tracking-tight">
                {b.title}
              </span>
              <span className="text-[11px] text-brand-muted leading-tight mt-0.5">
                {b.desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
