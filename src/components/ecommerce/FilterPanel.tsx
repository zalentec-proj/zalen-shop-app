import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Check, RefreshCw } from 'lucide-react';
import { FilterState } from '../../types';

interface FilterPanelProps {
  initialFilter: FilterState;
  onFilterChange: (filters: FilterState) => void;
  categories: { label: string; value: string; count: number }[];
}

export default function FilterPanel({ initialFilter, onFilterChange, categories }: FilterPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialFilter.category);
  const [maxPrice, setMaxPrice] = useState<number>(initialFilter.maxPrice);

  useEffect(() => {
    setSelectedCategory(initialFilter.category);
    setMaxPrice(initialFilter.maxPrice);
  }, [initialFilter]);

  const handleApply = () => {
    onFilterChange({
      category: selectedCategory,
      minPrice: 100,
      maxPrice: maxPrice,
    });
  };

  const handleClear = () => {
    setSelectedCategory(null);
    setMaxPrice(15000);
    onFilterChange({
      category: null,
      minPrice: 100,
      maxPrice: 15000,
    });
  };

  return (
    <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6 text-left relative overflow-hidden">
      {/* Visual glowing border lines */}
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-primary/30"></div>

      <div className="flex items-center justify-between border-b border-brand-border-soft pb-4">
        <span className="flex items-center gap-2 text-sm font-bold text-white font-display">
          <SlidersHorizontal className="w-4 h-4 text-blue-primary" />
          Filtros
        </span>
        <button
          onClick={handleClear}
          className="text-xs font-semibold text-brand-muted hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Limpar
        </button>
      </div>

      {/* Categories section */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold tracking-wider text-brand-white uppercase font-display">
          Categorias
        </span>
        <div className="flex flex-col gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.value;

            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(isSelected ? null : cat.value)}
                className="w-full h-11 px-3 rounded-xl flex items-center justify-between transition-colors text-[13px] text-brand-white hover:bg-white/5 cursor-pointer text-left focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-blue-primary border-blue-primary text-white shadow-[0_0_8px_rgba(30,61,255,0.4)]'
                      : 'border-white/20 bg-transparent'
                  }`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span className={`${isSelected ? 'text-white font-semibold' : 'text-brand-white'}`}>
                    {cat.label}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-brand-muted bg-white/[0.03] px-2 py-0.5 rounded-md">
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Price filter section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-brand-white uppercase font-display">
            Faixa de preço
          </span>
          <span className="text-xs font-mono font-medium text-green-accent">
            R$ {maxPrice.toLocaleString('pt-BR')}
          </span>
        </div>
        
        {/* Simple visual Slider */}
        <div className="flex flex-col gap-2">
          <input
            type="range"
            min="100"
            max="15000"
            step="100"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-primary filter hover:brightness-110"
          />
          <div className="flex justify-between text-[11px] font-mono text-brand-muted">
            <span>R$ 100</span>
            <span>R$ 15.000</span>
          </div>
        </div>
      </div>

      {/* Apply action button */}
      <button
        onClick={handleApply}
        className="w-full h-12 rounded-xl text-xs font-bold tracking-wider text-white bg-blue-primary/20 hover:bg-blue-primary border border-blue-primary/40 text-center flex items-center justify-center transition-all duration-300 shadow-[0_4px_15px_rgba(30,61,255,0.15)] cursor-pointer"
      >
        Aplicar filtros
      </button>
    </div>
  );
}
