import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Product, StorefrontCategory } from '../../types';
import ProductCard from '../ecommerce/ProductCard';
import {
  getAcceptedCategorySlugs,
  getPrimaryCategoryDefinition,
} from './category-display';

interface CategoryProductSectionsProps {
  products: Product[];
  categories: StorefrontCategory[];
  onProductClick: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  onExploreSection: (input: { categorySlug?: string; searchQuery?: string }) => void;
}

type ShowcaseSection = {
  id: string;
  title: string;
  categorySlug?: string;
  searchQuery?: string;
  products: Product[];
};

const sectionDefinitions = [
  {
    id: 'drones',
    title: 'Drones',
    categoryCandidates: ['drones', 'drone'],
    terms: ['drone'],
  },
  {
    id: 'baterias',
    title: 'Baterias',
    categoryCandidates: ['baterias', 'bateria'],
    terms: ['bateria', 'battery'],
  },
  {
    id: 'master-airscrew',
    title: 'Master Airscrew',
    terms: ['master airscrew', 'airscrew'],
  },
  {
    id: 'mini-3',
    title: 'Mini 3',
    terms: ['mini 3', 'mini3'],
  },
  {
    id: 'flip',
    title: 'Flip',
    categoryCandidates: ['flip'],
    terms: ['flip'],
  },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function productSearchText(product: Product) {
  return normalizeText(
    [
      product.name,
      product.subtitle,
      product.category,
      product.categorySlug,
      product.description,
      product.sku,
      ...(product.categories ?? []).flatMap((category) => [
        category.name,
        category.slug,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function findCategorySlug(
  categories: StorefrontCategory[],
  candidates: string[]
) {
  const normalizedCandidates = candidates.map(normalizeText);

  return categories.find((category) => {
    const text = normalizeText(`${category.name} ${category.slug}`);
    return normalizedCandidates.some((candidate) => text.includes(candidate));
  })?.slug;
}

function productMatchesCategory(
  product: Product,
  categories: StorefrontCategory[],
  categorySlug: string
) {
  const acceptedSlugs = new Set(getAcceptedCategorySlugs(categories, categorySlug));

  return (
    Boolean(product.categorySlug && acceptedSlugs.has(product.categorySlug)) ||
    Boolean(
      product.categories?.some((category) => acceptedSlugs.has(category.slug))
    )
  );
}

function productMatchesTerms(product: Product, terms: string[]) {
  const text = productSearchText(product);
  return terms.some((term) => text.includes(normalizeText(term)));
}

function scrollTrack(sectionId: string, direction: 'left' | 'right') {
  const track = document.getElementById(`showcase-track-${sectionId}`);

  track?.scrollBy({
    left: direction === 'right' ? 760 : -760,
    behavior: 'smooth',
  });
}

export default function CategoryProductSections({
  products,
  categories,
  onProductClick,
  onAddToCart,
  onExploreSection,
}: CategoryProductSectionsProps) {
  const sections = useMemo<ShowcaseSection[]>(() => {
    return sectionDefinitions
      .map((definition) => {
        const categorySlug = definition.categoryCandidates
          ? findCategorySlug(categories, definition.categoryCandidates)
          : undefined;
        const matchedProducts = products.filter((product) => {
          if (categorySlug && productMatchesCategory(product, categories, categorySlug)) {
            return true;
          }

          return productMatchesTerms(product, definition.terms);
        });

        return {
          id: definition.id,
          title: definition.title,
          categorySlug,
          searchQuery:
            categorySlug && getPrimaryCategoryDefinition(categorySlug)
              ? undefined
              : definition.title,
          products: matchedProducts.slice(0, 12),
        };
      })
      .filter((section) => section.products.length > 0);
  }, [categories, products]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <section className="w-full scroll-mt-24 px-3 py-9 md:scroll-mt-28 md:px-8 md:py-14" id="vitrines">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 md:gap-14">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-4 md:gap-5">
            <div className="flex items-center justify-between gap-3 sm:flex-row">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl md:text-3xl">
                  {section.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onExploreSection({
                      categorySlug: section.categorySlug,
                      searchQuery: section.searchQuery,
                    })
                  }
                  className="h-8 rounded-full border border-white/10 px-3 text-[11px] font-bold text-white transition hover:border-blue-primary/50 hover:text-blue-200 sm:h-10 sm:px-4 sm:text-xs"
                >
                  Ver categoria
                </button>
                <button
                  type="button"
                  onClick={() => scrollTrack(section.id, 'left')}
                  aria-label={`Voltar produtos de ${section.title}`}
                  className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white transition hover:border-white/20 sm:flex"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollTrack(section.id, 'right')}
                  aria-label={`Avançar produtos de ${section.title}`}
                  className="hidden h-10 w-10 items-center justify-center rounded-full border border-blue-primary/40 bg-blue-primary/10 text-blue-200 transition hover:border-blue-primary/70 sm:flex"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              id={`showcase-track-${section.id}`}
              className="-mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none] sm:-mx-4 sm:gap-5 sm:px-4 [&::-webkit-scrollbar]:hidden"
            >
              {section.products.map((product) => (
                <div
                  key={`${section.id}-${product.id}`}
                  className="w-[calc((100vw-42px)/2)] shrink-0 snap-start sm:w-[290px]"
                >
                  <ProductCard
                    product={product}
                    onProductClick={onProductClick}
                    onAddToCart={onAddToCart}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
