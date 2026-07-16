import React, { useState, useMemo } from 'react';
import { Product, FilterState, StorefrontCategory } from '../../types';
import ProductCard from '../ecommerce/ProductCard';
import FilterPanel from '../ecommerce/FilterPanel';
import { HelpCircle, Star, Sparkles } from 'lucide-react';
import { getAcceptedCategorySlugs } from './category-display';

interface BestSellersProps {
  products: Product[];
  categories: StorefrontCategory[];
  onProductClick: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  activeCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  searchQuery: string;
}

export default function BestSellers({
  products,
  categories,
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

  const categoriesList = useMemo(() => {
    const categoryMap = new Map<string, { label: string; value: string; count: number }>();

    categories.forEach((category) => {
      categoryMap.set(category.slug, {
        label: category.name,
        value: category.slug,
        count: category.productCount,
      });
    });

    products.forEach((product) => {
      const productCategories = product.categories?.length
        ? product.categories
        : product.categorySlug
          ? [{ id: product.categorySlug, name: product.category, slug: product.categorySlug }]
          : [];

      productCategories.forEach((category) => {
        if (categoryMap.has(category.slug)) {
          return;
        }

        const current = categoryMap.get(category.slug) ?? {
          label: category.name,
          value: category.slug,
          count: 0,
        };

        categoryMap.set(category.slug, {
          ...current,
          count: current.count + 1,
        });
      });
    });

    return Array.from(categoryMap.values());
  }, [categories, products]);

  // Filter products locally based on multiple states
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter comparison
      if (localFilters.category) {
        const acceptedSlugs = new Set(
          getAcceptedCategorySlugs(categories, localFilters.category)
        );
        const categoryMatches =
          (p.categorySlug ? acceptedSlugs.has(p.categorySlug) : false) ||
          p.categories?.some((category) => acceptedSlugs.has(category.slug));

        if (!categoryMatches) {
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
        const categoriesMatch =
          p.categories?.some((category) =>
            `${category.name} ${category.slug}`.toLowerCase().includes(q)
          ) ?? false;
        if (!nameMatch && !descMatch && !catMatch && !categoriesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [products, categories, localFilters, searchQuery]);

  return (
    <section className="w-full bg-transparent px-3 py-9 md:px-8 md:py-12" id="catalogo">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 md:gap-10">
        
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
              <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
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
