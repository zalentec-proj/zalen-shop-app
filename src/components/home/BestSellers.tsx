import React, { useState, useMemo } from 'react';
import { products } from '../../data/products';
import { Product, FilterState } from '../../types';
import ProductCard from '../ecommerce/ProductCard';
import FilterPanel from '../ecommerce/FilterPanel';
import { HelpCircle, Star, Sparkles } from 'lucide-react';

interface BestSellersProps {
  onProductClick: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  activeCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  searchQuery: string;
}

export default function BestSellers({
  onProductClick,
  onAddToCart,
  activeCategory,
  onCategorySelect,
  searchQuery,
}: BestSellersProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>({
    category: activeCategory,
    minPrice: 100,
    maxPrice: 15000,
  });

  // Sync category state from outside (e.g. Navbar or Categories)
  React.useEffect(() => {
    setLocalFilters((prev) => ({
      ...prev,
      category: activeCategory,
    }));
  }, [activeCategory]);

  const handleFilterChange = (newFilters: FilterState) => {
    setLocalFilters(newFilters);
    onCategorySelect(newFilters.category);
  };

  // Categories helper list counting
  const categoriesList = useMemo(() => {
    const list = [
      { label: 'Drones', count: 0 },
      { label: 'Peças', count: 0 },
      { label: 'Acessórios', count: 0 },
      { label: 'Baterias', count: 0 },
      { label: 'Kits e Combos', count: 0 },
    ];

    products.forEach((p) => {
      const match = list.find((item) => {
        if (p.category === 'Kits e Combos' && item.label === 'Kits e Combos') return true;
        return p.category.toLowerCase().includes(item.label.toLowerCase()) || item.label.toLowerCase().includes(p.category.toLowerCase());
      });
      if (match) {
        match.count += 1;
      }
    });

    return list;
  }, []);

  // Filter products locally based on multiple states
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter comparison
      if (localFilters.category) {
        const catTarget = localFilters.category.toLowerCase();
        const pTarget = p.category.toLowerCase();
        
        // Support cross match like 'Peças' matching 'Peças' or 'Peças e Componentes'
        const contains1 = pTarget.includes(catTarget);
        const contains2 = catTarget.includes(pTarget);
        const contains3 = (catTarget === 'peças' && pTarget.startsWith('peç'));
        
        if (!contains1 && !contains2 && !contains3) {
          return false;
        }
      }

      // Max price filter comparison
      if (p.price > localFilters.maxPrice) {
        return false;
      }

      // Live search query matching
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = p.description.toLowerCase().includes(q);
        const catMatch = p.category.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });
  }, [localFilters, searchQuery]);

  return (
    <section className="w-full px-4 md:px-8 py-12 bg-transparent" id="catalogo">
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        
        {/* Section Heading & descriptive caption */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-accent" />
              <span className="text-[11px] font-bold tracking-[0.25em] text-green-accent uppercase font-display">
                Catálogo de Voo
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#F5F7FA] font-display">
              Os mais vendidos da marca
            </h2>
            <p className="text-xs md:text-sm text-brand-muted max-w-lg mt-0.5">
              Peças de reposição e modelos homologados com garantia de procedência original antes de cada decolagem.
            </p>
          </div>

          {/* Filtering status description */}
          <div className="text-xs text-brand-muted font-mono bg-white/[0.03] border border-white/5 py-2 px-4 rounded-xl">
            Exibindo <span className="text-white font-bold">{filteredProducts.length}</span> de <span className="text-white font-bold">{products.length}</span> produtos
          </div>
        </div>

        {/* Catalog main double-column grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Collapsible responsive Sidebar Filters (Takes 3 columns) */}
          <div className="lg:col-span-3">
            <FilterPanel
              initialFilter={localFilters}
              onFilterChange={handleFilterChange}
              categories={categoriesList}
            />
          </div>

          {/* Right: Products item grid cards (Takes 9 columns of catalog) */}
          <div className="lg:col-span-9">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    onProductClick={onProductClick}
                    onAddToCart={onAddToCart}
                  />
                ))}
              </div>
            ) : (
              // Empty search state
              <div className="glass-panel rounded-3xl p-16 flex flex-col items-center justify-center text-center gap-4">
                <p className="text-base text-brand-white font-medium">Nenhum produto atendeu aos filtros selecionados.</p>
                <button
                  onClick={handleClear}
                  className="px-6 h-11 bg-blue-primary hover:opacity-90 text-white rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer"
                >
                  Limpar filtros do catálogo
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );

  function handleClear() {
    setLocalFilters({
      category: null,
      minPrice: 100,
      maxPrice: 15000,
    });
    onCategorySelect(null);
  }
}
