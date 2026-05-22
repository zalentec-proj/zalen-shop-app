import React from 'react';
import { ShieldAlert, Users, Compass, Cpu, Wrench, Landmark } from 'lucide-react';
import blueprintImg from '../../assets/images/drone_blueprint_1779242915877.png';

export default function TechSection() {
  const highlights = [
    {
      icon: <Cpu className="w-5 h-5 text-blue-primary" />,
      title: 'Peças 100% Originais',
      desc: 'Componentes adquiridos diretamente das plantas autorizadas da DJI e fornecedores credenciados.',
    },
    {
      icon: <Wrench className="w-5 h-5 text-green-accent" />,
      title: 'Suporte Técnico Exclusivo',
      desc: 'Corpo de engenheiros e técnicos treinados para calibração, setup fino e auxílio técnico remoto imediato.',
    },
    {
      icon: <Compass className="w-5 h-5 text-blue-primary" />,
      title: 'Envio Nacional Express',
      desc: 'Despacho ágil segurado de cargas tecnológicas para qualquer região brasileira com embalagem protetora.',
    },
  ];

  return (
    <section className="w-full px-4 md:px-8 py-20 bg-transparent relative overflow-hidden" id="tecnologia">
      {/* Visual blueprint background asset */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-full max-w-5xl h-[450px] opacity-[0.14] -z-10 bg-no-repeat bg-center bg-contain select-none pointer-events-none"
           style={{ backgroundImage: `url(${blueprintImg})` }}>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col gap-14 text-center">
        
        {/* Core center head copy */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold tracking-[0.3em] text-blue-primary uppercase font-display bg-blue-primary/10 border border-blue-primary/20 py-1 px-3 rounded-full">
            ENGENHARIA E PRECISÃO
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-display max-w-2xl leading-[1.12]">
            Tecnologia que conecta. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-primary to-green-accent">Performance</span> que transforma.
          </h2>
          <p className="text-sm sm:text-base text-brand-muted max-w-xl text-center leading-relaxed font-normal">
            A Brasil Drones & Parts trabalha apenas com produtos originais, componentes selecionados e suporte altamente capacitado para assegurar sua tranquilidade e foco em cada decolagem.
          </p>
        </div>

        {/* 3 cards horizontais / bento-grid de engenharia */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {highlights.map((item, idx) => (
            <div
              key={idx}
              className="group glass-panel rounded-3xl p-8 flex flex-col gap-4 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-primary/5 rounded-full blur-xl group-hover:bg-blue-primary/10 transition-colors"></div>

              {/* Icon stage */}
              <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                {item.icon}
              </div>

              {/* Labels details */}
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight font-display">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-[13px] text-brand-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tech decorative blueprint caption */}
        <div className="w-full flex items-center justify-center select-none gap-6 opacity-30 animate-tech-pulse text-[10px] font-mono tracking-[0.2em] text-brand-white">
          <span>SPEC LOG: VER-8.91</span>
          <span className="w-2 h-2 rounded-full bg-blue-primary"></span>
          <span>AERO-ENG DEPT</span>
          <span className="w-2 h-2 rounded-full bg-green-accent"></span>
          <span>SYSTEMS READY</span>
        </div>

      </div>
    </section>
  );
}
