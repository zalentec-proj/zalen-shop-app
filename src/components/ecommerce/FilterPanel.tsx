import React, { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { FilterState } from '../../types';

interface FilterPanelProps {
  initialFilter: FilterState;
  onFilterChange: (filters: FilterState) => void;
  categories: { label: string; value: string; count: number }[];
}

export default function FilterPanel({
  initialFilter,
  onFilterChange,
  categories,
}: FilterPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialFilter.category
  );
  const [maxPrice, setMaxPrice] = useState(initialFilter.maxPrice);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setSelectedCategory(initialFilter.category);
    setMaxPrice(initialFilter.maxPrice);
  }, [initialFilter]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileOpen]);

  const visibleCategories = useMemo(() => {
    const query = categoryQuery.trim().toLocaleLowerCase('pt-BR');
    if (!query) {
      return showAllCategories ? categories : categories.slice(0, 12);
    }

    return categories.filter((category) =>
      `${category.label} ${category.value}`
        .toLocaleLowerCase('pt-BR')
        .includes(query)
    );
  }, [categories, categoryQuery, showAllCategories]);

  const apply = () => {
    onFilterChange({
      category: selectedCategory,
      minPrice: 0,
      maxPrice,
    });
    setMobileOpen(false);
  };

  const clear = () => {
    setSelectedCategory(null);
    setCategoryQuery('');
    setShowAllCategories(false);
    setMaxPrice(15000);
    onFilterChange({ category: null, minPrice: 0, maxPrice: 15000 });
  };

  const renderControls = () => (
    <>
      <div className="flex items-center justify-between border-b border-brand-border-soft pb-4">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <SlidersHorizontal className="h-4 w-4 text-blue-primary" />
          Filtros
        </span>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-muted transition hover:text-white"
        >
          <RefreshCw className="h-3 w-3" />
          Limpar
        </button>
      </div>

      <div className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input
            type="search"
            value={categoryQuery}
            onChange={(event) => setCategoryQuery(event.target.value)}
            placeholder="Buscar categoria ou modelo"
            className="h-11 w-full rounded-xl border border-white/10 bg-[#050A14] pl-10 pr-3 text-sm text-white outline-none placeholder:text-brand-muted focus:border-blue-primary"
          />
        </label>

        <div className="max-h-[min(46vh,430px)] space-y-1 overflow-y-auto pr-1">
          {visibleCategories.map((category) => {
            const isSelected = selectedCategory === category.value;

            return (
              <button
                key={category.value}
                type="button"
                onClick={() =>
                  setSelectedCategory(isSelected ? null : category.value)
                }
                className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition ${
                  isSelected
                    ? 'bg-blue-primary/15 text-white'
                    : 'text-brand-white hover:bg-white/5'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? 'border-blue-primary bg-blue-primary text-white'
                        : 'border-white/20'
                    }`}
                  >
                    {isSelected ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="truncate">{category.label}</span>
                </span>
                <span className="ml-3 rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-brand-muted">
                  {category.count}
                </span>
              </button>
            );
          })}

          {!categoryQuery.trim() && categories.length > 12 ? (
            <button
              type="button"
              onClick={() => setShowAllCategories((current) => !current)}
              className="mt-2 min-h-10 w-full rounded-xl border border-white/10 px-3 text-xs font-semibold text-blue-200 transition hover:border-blue-primary/40 hover:text-white"
            >
              {showAllCategories
                ? 'Mostrar menos categorias'
                : `Mostrar todas (${categories.length})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-t border-brand-border-soft pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-brand-white">
            Preço máximo
          </span>
          <span className="font-mono text-green-accent">
            R$ {maxPrice.toLocaleString('pt-BR')}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="15000"
          step="100"
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-blue-primary"
        />
      </div>

      <button
        type="button"
        onClick={apply}
        className="h-12 w-full rounded-xl border border-blue-primary/40 bg-blue-primary text-xs font-bold uppercase tracking-wider text-white transition hover:brightness-110"
      >
        Aplicar filtros
      </button>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-blue-primary/30 bg-[#0A1730] px-4 text-sm font-semibold text-white lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-300" />
          Filtrar produtos
        </span>
        {selectedCategory ? (
          <span className="max-w-36 truncate text-xs text-blue-200">
            {categories.find((item) => item.value === selectedCategory)?.label}
          </span>
        ) : null}
      </button>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-[#050A14] text-left lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros do catálogo"
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <span className="font-semibold text-white">Filtrar catálogo</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white"
              aria-label="Fechar filtros"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            {renderControls()}
          </div>
        </div>
      ) : null}

      <aside className="glass-panel sticky top-28 hidden flex-col gap-5 rounded-2xl p-5 text-left lg:flex">
        {renderControls()}
      </aside>
    </>
  );
}
