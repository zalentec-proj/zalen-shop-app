import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ReceiptText,
  Search,
  User,
  ShoppingCart,
  Instagram,
  Menu,
  X,
} from 'lucide-react';
import Logo from '../ui/Logo';
import { SafeCatalogImage } from '../ui/SafeCatalogImage';
import type { StorefrontCategory } from '../../types';
import { getPrimaryStorefrontCategories } from '../home/category-display';
import type {
  StorefrontNavigation,
  StorefrontNavigationItem,
} from '@/modules/catalog/storefront-navigation';
import {
  getStorefrontSearchResults,
  type StorefrontSearchProductPreview,
} from '@/modules/catalog/storefront-search';

const INSTAGRAM_URL = 'https://www.instagram.com/dronesepartsbrasildji/';

interface NavbarProps {
  categories: StorefrontCategory[];
  navigation?: StorefrontNavigation;
  cartItemsCount: number;
  onCartToggle: () => void;
  activeCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  onNavigateToHome: () => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  productPreviews?: StorefrontSearchProductPreview[];
}

function normalizePreviewText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function getMenuProductPreviews(
  item: StorefrontNavigationItem,
  products: StorefrontSearchProductPreview[]
) {
  if (products.length === 0) return [];

  const terms = (item.children.length > 0 ? item.children : [item])
    .map((child) => normalizePreviewText(child.label))
    .filter((label) => label.length >= 3)
    .sort((left, right) => right.length - left.length);
  const matchingProducts = products.filter((product) => {
    const haystack = normalizePreviewText(
      `${product.name} ${product.searchText ?? ''}`
    );
    return terms.some((term) => haystack.includes(term));
  });

  return (matchingProducts.length > 0 ? matchingProducts : products).slice(0, 6);
}

function formatPrice(price: number | undefined) {
  if (typeof price !== 'number') return undefined;

  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function Navbar({
  categories,
  navigation,
  cartItemsCount,
  onCartToggle,
  activeCategory,
  onCategorySelect,
  onNavigateToHome,
  onSearchChange,
  searchQuery,
  productPreviews = [],
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoriesMenuOpen, setCategoriesMenuOpen] = useState(false);
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [previewIndexes, setPreviewIndexes] = useState<Record<string, number>>({});
  const categoriesMenuRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!categoriesMenuOpen) return;

    const closeOnOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (target instanceof Node && !categoriesMenuRef.current?.contains(target)) {
        setCategoriesMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoriesMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideInteraction);
    document.addEventListener('touchstart', closeOnOutsideInteraction);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideInteraction);
      document.removeEventListener('touchstart', closeOnOutsideInteraction);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [categoriesMenuOpen]);

  useEffect(() => {
    if (!searchSuggestionsOpen) return;

    const closeOnOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (desktopSearchRef.current?.contains(target)) return;
      if (mobileSearchRef.current?.contains(target)) return;
      setSearchSuggestionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchSuggestionsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideInteraction);
    document.addEventListener('touchstart', closeOnOutsideInteraction);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideInteraction);
      document.removeEventListener('touchstart', closeOnOutsideInteraction);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [searchSuggestionsOpen]);

  const navLinks = useMemo(() => {
    if (navigation?.navbarItems.length) {
      return navigation.navbarItems;
    }

    return getPrimaryStorefrontCategories(categories).map((category) => ({
      id: category.slug,
      label: category.name,
      type: 'category' as const,
      categorySlug: category.slug,
      href: `/categoria/${category.slug}`,
      position: 0,
      enabled: true,
      showInNavbar: true,
      showInCategoriesDropdown: false,
      opensInDropdown: false,
      children: [],
    }));
  }, [categories, navigation]);

  const categoryProductCountBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.productCount])),
    [categories]
  );

  const visibleNavLinks = useMemo(() => {
    const isCategoriesRoot = (item: StorefrontNavigationItem) =>
      item.label.trim().toLocaleLowerCase('pt-BR') === 'categorias';
    const hasProductsInBranch = (item: StorefrontNavigationItem): boolean => {
      const productCount = item.categorySlug
        ? categoryProductCountBySlug.get(item.categorySlug)
        : undefined;

      return (
        productCount === undefined ||
        productCount > 0 ||
        item.children.some(hasProductsInBranch)
      );
    };

    return navLinks
      .filter((item) => isCategoriesRoot(item) || hasProductsInBranch(item))
      .map((item) => ({
        ...item,
        children: item.children.filter(
          (child) =>
            child.showInCategoriesDropdown ||
            hasProductsInBranch(child) ||
            child.id.startsWith('bling-category-')
        ),
      }));
  }, [categoryProductCountBySlug, navLinks]);

  const compactCategoryMenuItems = useMemo(
    () => {
      const categoriesRoot = visibleNavLinks.find(
        (item) => item.label.trim().toLocaleLowerCase('pt-BR') === 'categorias'
      );

      return categoriesRoot?.children ?? navigation?.categoryDropdownItems ?? [];
    },
    [navigation, visibleNavLinks]
  );

  const normalizedSearchQuery = searchQuery.trim();
  const searchResults = useMemo(
    () => getStorefrontSearchResults(productPreviews, searchQuery),
    [productPreviews, searchQuery]
  );
  const showSearchSuggestions =
    searchSuggestionsOpen && normalizedSearchQuery.length > 0;

  const renderSearchSuggestions = (id: string) => (
    <div
      id={id}
      aria-live="polite"
      className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-xl border border-white/10 bg-[#071124]/98 shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl"
    >
      {searchResults.length > 0 ? (
        <ul className="max-h-[min(65vh,420px)] overflow-y-auto p-2">
          {searchResults.map((product) => (
            <li key={product.id}>
              <Link
                href={product.href}
                onClick={() => setSearchSuggestionsOpen(false)}
                className="flex items-center gap-3 rounded-lg p-2.5 transition hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/8 bg-black/20 p-1">
                  <SafeCatalogImage
                    src={product.imageUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm font-semibold leading-5 text-white">
                    {product.name}
                  </span>
                  {formatPrice(product.price) ? (
                    <span className="mt-0.5 block text-xs font-semibold text-green-accent">
                      {formatPrice(product.price)}
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-center text-sm text-brand-muted">
          Nenhum produto encontrado para “{normalizedSearchQuery}”.
        </p>
      )}
    </div>
  );

  const handleLinkClick = (categoryValue: string | null) => {
    onCategorySelect(categoryValue);
    setMobileMenuOpen(false);
    // Smooth scroll to product grid
    const section = document.getElementById('catalogo');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const renderDesktopItem = (item: StorefrontNavigationItem) => {
    const isActive = activeCategory === item.categorySlug;
    const isCategoriesRoot = item.label.trim().toLocaleLowerCase('pt-BR') === 'categorias';
    const hasChildren = !isCategoriesRoot && item.children.length > 0;
    const previewProducts = hasChildren
      ? getMenuProductPreviews(item, productPreviews)
      : [];
    const selectedPreviewIndex = previewIndexes[item.id] ?? 0;
    const previewProduct = previewProducts.length > 0
      ? previewProducts[selectedPreviewIndex % previewProducts.length]
      : undefined;
    const hasPreviewCarousel = previewProducts.length > 1;
    const className = `inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[13px] font-medium tracking-wide transition-colors duration-200 cursor-pointer hover:text-white ${
      isActive ? 'text-white' : 'text-brand-muted'
    } ${isActive ? 'border-blue-primary' : 'border-transparent hover:border-white/30'}`;
    const content = (
      <>
        {isCategoriesRoot ? <Menu className="h-4 w-4 text-green-accent" /> : null}
        <span>{item.label}</span>
        {isCategoriesRoot || hasChildren ? <ChevronDown className="h-3.5 w-3.5" /> : null}
      </>
    );

    return (
      <div
        key={item.id}
        className={hasChildren ? 'group' : undefined}
        ref={isCategoriesRoot ? categoriesMenuRef : undefined}
      >
        {isCategoriesRoot ? (
          <button
            type="button"
            className={className}
            onClick={() => setCategoriesMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={categoriesMenuOpen}
          >
            {content}
          </button>
        ) : item.href ? (
          <Link href={item.href} className={className}>
            {content}
          </Link>
        ) : (
          <button
            type="button"
            className={className}
            onClick={() => handleLinkClick(item.categorySlug ?? null)}
          >
            {content}
          </button>
        )}

        {hasChildren ? (
          <div className="invisible absolute left-1/2 top-full z-50 mt-2 w-[min(720px,calc(100vw-64px))] -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#071124]/95 opacity-0 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="grid min-h-[240px] grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)]">
              <div className="border-r border-white/10 py-3">
                <span className="block px-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted">
                  {item.label}
                </span>
                <div className="max-h-[224px] overflow-y-auto px-2">
                  {item.children.map((child) => (
                    child.href ? (
                      <Link
                        key={child.id}
                        href={child.href}
                        className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
                      >
                        <span>{child.label}</span>
                        {child.children.length > 0 ? <ChevronDown className="h-3.5 w-3.5 -rotate-90" /> : null}
                      </Link>
                    ) : (
                      <span
                        key={child.id}
                        className="flex min-h-10 cursor-default items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium text-slate-200"
                      >
                        <span>{child.label}</span>
                      </span>
                    )
                  ))}
                </div>
              </div>

              {previewProduct ? (
                <div className="relative flex items-center justify-center bg-[#050A14]/55 p-4">
                  <Link
                    href={previewProduct.href}
                    className="group/product flex w-full max-w-[320px] flex-col items-center text-center"
                  >
                    <div className="flex h-32 w-full items-center justify-center overflow-hidden">
                      <SafeCatalogImage
                        src={previewProduct.imageUrl}
                        alt={previewProduct.name}
                        className="h-full max-w-full object-contain transition duration-300 group-hover/product:scale-105"
                      />
                    </div>
                    <span className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-white group-hover/product:text-[#8FDFFF]">
                      {previewProduct.name}
                    </span>
                    {formatPrice(previewProduct.price) ? (
                      <span className="mt-1 text-base font-bold text-green-accent">
                        {formatPrice(previewProduct.price)}
                      </span>
                    ) : null}
                  </Link>

                  {hasPreviewCarousel ? (
                    <>
                      <button
                        type="button"
                        aria-label="Produto anterior"
                        onClick={() => setPreviewIndexes((current) => ({
                          ...current,
                          [item.id]: (selectedPreviewIndex - 1 + previewProducts.length) % previewProducts.length,
                        }))}
                        className="absolute left-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#071124]/85 text-white transition hover:border-blue-primary hover:bg-blue-primary"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Próximo produto"
                        onClick={() => setPreviewIndexes((current) => ({
                          ...current,
                          [item.id]: (selectedPreviewIndex + 1) % previewProducts.length,
                        }))}
                        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#071124]/85 text-white transition hover:border-blue-primary hover:bg-blue-primary"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center justify-center px-8 text-center text-sm text-brand-muted">
                  Produtos desta categoria aparecerão aqui.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {isCategoriesRoot && categoriesMenuOpen ? (
          <div
            role="menu"
            aria-label="Categorias da loja"
            className="absolute left-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-xl border border-white/10 bg-[#071124] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.52)]"
          >
            <div className="max-h-[min(65vh,520px)] space-y-1 overflow-y-auto pr-1">
              {compactCategoryMenuItems.length > 0 ? (
                compactCategoryMenuItems.map((menuItem) =>
                  menuItem.children.length > 0 ? (
                    <details key={menuItem.id} className="group/menu rounded-lg">
                      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]">
                        <span>{menuItem.label}</span>
                        <ChevronDown className="h-4 w-4 text-brand-muted transition group-open/menu:rotate-180" />
                      </summary>
                      <div className="mb-1 ml-3 border-l border-white/10 py-1 pl-2">
                        {menuItem.href ? (
                          <Link
                            href={menuItem.href}
                            role="menuitem"
                            onClick={() => setCategoriesMenuOpen(false)}
                            className="block rounded-md px-3 py-2 text-xs font-medium text-brand-muted transition hover:bg-white/[0.06] hover:text-white"
                          >
                            Ver todos em {menuItem.label}
                          </Link>
                        ) : null}
                        {menuItem.children.map((child) => (
                          <Link
                            key={child.id}
                            href={child.href ?? '#'}
                            role="menuitem"
                            onClick={(event) => {
                              if (!child.href) event.preventDefault();
                              setCategoriesMenuOpen(false);
                            }}
                            className="block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </details>
                  ) : menuItem.href ? (
                    <Link
                      key={menuItem.id}
                      href={menuItem.href}
                      role="menuitem"
                      onClick={() => setCategoriesMenuOpen(false)}
                      className="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] hover:text-white"
                    >
                      {menuItem.label}
                    </Link>
                  ) : null
                )
              ) : (
                <p className="px-3 py-4 text-sm text-brand-muted">
                  Categorias disponíveis em breve.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent px-3 pt-2 md:px-8 md:pt-3">
      <nav
        id="navbar-main"
        className="navbar-glass relative z-20 mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl px-4 shadow-[0_12px_32px_rgba(0,0,0,0.55)] transition-all duration-300 hover:border-white/20 md:h-[78px] md:rounded-[28px] md:px-8"
      >
        <button
          onClick={() => {
            onCategorySelect(null);
            onNavigateToHome();
          }}
          className="shrink-0 cursor-pointer focus:outline-none"
          aria-label="Ir para a página inicial"
        >
          <Logo size="sm" className="h-[30px] md:h-[48px]" />
        </button>

        <div
          ref={desktopSearchRef}
          className="relative mx-6 hidden min-w-0 max-w-md flex-1 md:block"
        >
          <label htmlFor="storefront-search-desktop" className="sr-only">
            Buscar produtos
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input
            id="storefront-search-desktop"
            type="search"
            placeholder="O que você procura?"
            value={searchQuery}
            onFocus={() => setSearchSuggestionsOpen(true)}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setSearchSuggestionsOpen(true);
            }}
            aria-controls="storefront-search-results-desktop"
            aria-expanded={showSearchSuggestions}
            className="h-11 w-full rounded-lg border border-white/10 bg-[#05070B]/55 pl-11 pr-4 text-sm text-brand-white outline-none transition placeholder:text-brand-muted focus:border-blue-primary focus:bg-[#05070B]/80"
          />
          {showSearchSuggestions
            ? renderSearchSuggestions('storefront-search-results-desktop')
            : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => setSearchOpen((open) => !open)}
            className="rounded-full p-2 text-brand-white transition-colors hover:bg-white/5 hover:text-blue-primary md:hidden"
            id="search-btn"
            aria-label="Buscar produtos"
            aria-expanded={searchOpen}
          >
            <Search className="h-5 w-5" />
          </button>

          <Link
            href="/conta"
            aria-label="Minha conta"
            title="Minha conta"
            className="hidden h-10 items-center gap-2 rounded-full px-3 text-brand-white transition-colors hover:bg-white/5 hover:text-blue-primary sm:flex"
            id="user-btn"
          >
            <User className="h-5 w-5" />
            <span className="hidden text-xs font-semibold lg:inline">Minha conta</span>
          </Link>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram da Brasil Drones"
            title="Instagram da Brasil Drones"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-brand-white transition-colors hover:bg-white/5 hover:text-[#E1306C] md:inline-flex"
          >
            <Instagram className="h-5 w-5" />
          </a>

          <button
            onClick={onCartToggle}
            className="relative cursor-pointer rounded-full p-2 text-brand-white transition-colors hover:bg-white/5 hover:text-blue-primary"
            id="cart-trigger"
            aria-label="Abrir carrinho"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItemsCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-accent text-[9px] font-bold text-[#05070B] shadow-[0_0_8px_#00E676]" id="cart-badge">
                {cartItemsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="cursor-pointer p-2 text-brand-white transition-colors hover:text-blue-primary xl:hidden"
            id="menu-toggle"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {searchOpen ? (
        <div
          ref={mobileSearchRef}
          className="navbar-glass relative mx-auto mt-2 flex max-w-7xl rounded-xl p-2 md:hidden"
        >
          <label htmlFor="storefront-search-mobile" className="sr-only">
            Buscar produtos
          </label>
          <div className="relative flex w-full items-center">
            <Search className="pointer-events-none absolute left-4 h-4 w-4 text-brand-muted" />
            <input
              id="storefront-search-mobile"
              type="search"
              autoFocus
              placeholder="Buscar drone ou peça..."
              value={searchQuery}
              onFocus={() => setSearchSuggestionsOpen(true)}
              onChange={(event) => {
                onSearchChange(event.target.value);
                setSearchSuggestionsOpen(true);
              }}
              aria-controls="storefront-search-results-mobile"
              aria-expanded={showSearchSuggestions}
              className="h-11 w-full rounded-lg border border-white/10 bg-[#05070B]/55 pl-11 pr-4 text-sm text-brand-white outline-none transition placeholder:text-brand-muted focus:border-blue-primary"
            />
          </div>
          {showSearchSuggestions
            ? renderSearchSuggestions('storefront-search-results-mobile')
            : null}
        </div>
      ) : null}

      <nav
        aria-label="Categorias da loja"
        className="mx-auto mt-2 hidden max-w-7xl overflow-visible rounded-xl border border-[#315de0]/35 bg-[#0A1B4D]/95 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl xl:block"
      >
        <div className="relative flex h-10 items-stretch overflow-visible px-4 md:px-5">
          {visibleNavLinks.map(renderDesktopItem)}
        </div>
      </nav>

      {mobileMenuOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-[80px] z-40 flex flex-col gap-4 overflow-y-auto border-t border-white/10 bg-[#050A14] px-4 pb-8 pt-5 shadow-[0_24px_80px_rgba(0,0,0,0.8)] animate-in fade-in duration-200 xl:hidden"
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold tracking-widest text-brand-muted uppercase mb-2 px-3">
              Categorias
            </span>
            {navLinks.map((link) => {
              const isActive = activeCategory === link.categorySlug;
              const itemClassName = `w-full text-left py-3 px-4 rounded-xl text-[15px] font-medium transition-colors ${
                isActive ? 'bg-blue-primary/15 text-white border-l-4 border-blue-primary' : 'text-brand-white hover:bg-white/5'
              }`;

              if (link.children.length > 0) {
                return (
                  <details key={link.id} className="rounded-xl bg-white/[0.02]">
                    <summary className={`${itemClassName} flex cursor-pointer list-none items-center justify-between`}>
                      <span>{link.label}</span>
                      <ChevronDown className="h-4 w-4" />
                    </summary>
                    <div className="grid gap-1 px-3 pb-3">
                      {link.children.map((child) => (
                        child.href ? (
                          <Link
                            key={child.id}
                            href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="rounded-lg px-4 py-2.5 text-sm font-medium text-brand-muted transition hover:bg-white/5 hover:text-white"
                          >
                            {child.label}
                          </Link>
                        ) : (
                          <span
                            key={child.id}
                            className="rounded-lg px-4 py-2.5 text-sm font-medium text-brand-muted"
                          >
                            {child.label}
                          </span>
                        )
                      ))}
                    </div>
                  </details>
                );
              }

              return link.href ? (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={itemClassName}
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.categorySlug ?? null)}
                  className={itemClassName}
                >
                  {link.label}
                </button>
              );
            })}
          </div>

          <div className="h-[1px] bg-brand-border my-2"></div>

          <div className="grid gap-2 px-3 py-1">
            <Link
              href="/conta"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-brand-white"
            >
              <span className="text-sm font-semibold">Minha conta</span>
              <User className="w-4 h-4" />
            </Link>
            <Link
              href="/conta/pedidos"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-brand-white"
            >
              <span className="text-sm font-semibold">Meus pedidos</span>
              <ReceiptText className="w-4 h-4" />
            </Link>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-brand-white"
            >
              <span className="text-sm font-semibold">Instagram</span>
              <Instagram className="h-4 w-4 text-[#E1306C]" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
