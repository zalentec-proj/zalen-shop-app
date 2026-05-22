import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface CategoriesProps {
  onCategorySelect: (category: string | null) => void;
  activeCategory: string | null;
}

export default function Categories({ onCategorySelect, activeCategory }: CategoriesProps) {
  const categoriesList = [
    {
      name: 'Drones',
      value: 'Drones',
      image: '/src/assets/images/mavic_3_pro_1779242859141.png',
      lineColor: 'bg-blue-primary shadow-[0_0_8px_rgba(30,61,255,0.5)]',
      glowColor: 'from-blue-primary/10 to-transparent',
    },
    {
      name: 'Peças e Componentes',
      value: 'Peças',
      image: '/src/assets/images/cat_motor_piston_1779248613015.png',
      lineColor: 'bg-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.5)]',
      glowColor: 'from-[#00D4FF]/10 to-transparent',
    },
    {
      name: 'Baterias',
      value: 'Baterias',
      image: '/src/assets/images/cat_battery_pack_1779248627109.png',
      lineColor: 'bg-[#00E676] shadow-[0_0_8px_rgba(0,230,118,0.5)]',
      glowColor: 'from-[#00E676]/10 to-transparent',
    },
    {
      name: 'Acessórios',
      value: 'Acessórios',
      image: '/src/assets/images/cat_smart_controller_1779248641029.png',
      lineColor: 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]',
      glowColor: 'from-indigo-400/10 to-transparent',
    },
    {
      name: 'Kits e Combos',
      value: 'Kits e Combos',
      image: '/src/assets/images/cat_waterproof_case_1779248659640.png',
      lineColor: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]',
      glowColor: 'from-sky-400/10 to-transparent',
    },
  ];

  const handleCategoryClick = (val: string) => {
    onCategorySelect(activeCategory === val ? null : val);
    const section = document.getElementById('catalogo');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="w-full px-4 md:px-8 py-16 bg-transparent" id="categorias">
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        
        {/* Section Heading styled exactly like Image 2 */}
        <div className="flex items-center justify-between w-full">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white font-display">
            Compre por <span className="bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 bg-clip-text text-transparent font-bold">categoria</span>
          </h2>
          
          {/* Decorative navigation buttons from Image 2 */}
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full border border-white/10 bg-black/20 hover:border-white/20 text-brand-white flex items-center justify-center transition-all cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 rounded-full border border-blue-primary/40 bg-blue-primary/5 hover:border-blue-primary/60 text-blue-400 flex items-center justify-center transition-all cursor-pointer shadow-[0_0_15px_rgba(30,61,255,0.25)]">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Categories Grid - 5 Columns for high-end feel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {categoriesList.map((cat) => {
            const isCurrent = activeCategory === cat.value;
            return (
              <div
                key={cat.name}
                onClick={() => handleCategoryClick(cat.value)}
                className={`group rounded-3xl p-6 relative flex flex-col justify-end overflow-hidden cursor-pointer transition-all duration-500 h-[380px] hover:-translate-y-2 border ${
                  isCurrent 
                    ? 'border-blue-primary/60 bg-blue-primary/[0.04] shadow-[0_0_40px_rgba(30,61,255,0.25)]' 
                    : 'border-white/5 bg-gradient-to-b from-[#0B1528]/40 to-[#040814] hover:border-white/15'
                }`}
              >
                {/* Glow Orb backing light inside card, centered on image */}
                <div className={`absolute left-1/2 top-[35%] -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-r ${cat.glowColor} rounded-full blur-3xl group-hover:scale-125 transition-all duration-700 pointer-events-none -z-10`}></div>

                {/* Card Top: Product Image taking up the entire upper half edge-to-edge */}
                <div className="absolute top-0 left-0 w-full h-[265px] overflow-hidden rounded-t-3xl select-none pointer-events-none">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover filter drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)] group-hover:scale-108 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                  {/* Subtle dark gradient overlay on the bottom edge of the image to blend smoothly into the black bottom background */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#040814] via-[#040814]/10 to-transparent"></div>
                </div>

                {/* Card Bottom: Accent Line & Title with Arrow */}
                <div className="flex flex-col text-left z-10 mt-auto">
                  {/* Indicator Accent Line exactly like Image 2 */}
                  <div className={`w-10 h-[2px] rounded-full mb-4 transition-all duration-300 ${cat.lineColor} group-hover:w-16`}></div>
                  
                  {/* Row for Title + Inline Arrow */}
                  <div className="flex items-center justify-between w-full gap-3">
                    <h3 className="text-base sm:text-[17px] font-bold text-[#F5F7FA] tracking-tight group-hover:text-white transition-colors leading-snug">
                      {cat.name}
                    </h3>
                    <div className="w-10 h-10 rounded-full border border-white/10 group-hover:border-teal-400/40 group-hover:bg-teal-400/5 flex items-center justify-center transition-all duration-300 shrink-0">
                      <ArrowRight className="w-4 h-4 text-brand-muted group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
