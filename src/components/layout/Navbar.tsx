import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ReceiptText,
  Search,
  User,
  ShoppingCart,
  Menu,
  X,
} from 'lucide-react';
import Logo from '../ui/Logo';
import type { StorefrontCategory } from '../../types';
import { getPrimaryStorefrontCategories } from '../home/category-display';
import type {
  StorefrontNavigation,
  StorefrontNavigationItem,
} from '@/modules/catalog/storefront-navigation';

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
  searchQuery
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    const hasChildren = item.children.length > 0;
    const className = `inline-flex items-center gap-1 text-[13px] font-medium tracking-wide transition-all duration-300 relative py-1 cursor-pointer hover:text-white ${
      isActive ? 'text-white' : 'text-brand-muted'
    }`;
    const content = (
      <>
        <span>{item.label}</span>
        {hasChildren ? <ChevronDown className="h-3.5 w-3.5" /> : null}
        {isActive && (
          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-primary rounded-full shadow-[0_0_8px_#1E3DFF]"></span>
        )}
      </>
    );

    return (
      <div key={item.id} className="group relative">
        {item.href ? (
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
          <div className="invisible absolute left-1/2 top-full z-50 mt-4 w-[min(720px,calc(100vw-64px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#071124]/95 p-4 opacity-0 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {item.children.map((child) => (
                child.href ? (
                  <Link
                    key={child.id}
                    href={child.href}
                    className="group/link rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3 transition hover:border-blue-primary/35 hover:bg-blue-primary/10"
                  >
                    <span className="block text-sm font-semibold text-white">
                      {child.label}
                    </span>
                    {child.children.length > 0 ? (
                      <span className="mt-1 block text-[11px] text-brand-muted">
                        {child.children.length} subcategorias
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <div
                    key={child.id}
                    className="rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3"
                  >
                    <span className="block text-sm font-semibold text-white">
                      {child.label}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-transparent">
      {/* Floating glass bar / Sleek nav bar */}
      <nav id="navbar-main" className="max-w-7xl mx-auto h-[82px] px-6 md:px-8 rounded-full flex items-center justify-between navbar-glass transition-all duration-300 hover:border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
        {/* Brand Logo */}
        <button
          onClick={() => {
            onCategorySelect(null);
            onNavigateToHome();
          }}
          className="focus:outline-none cursor-pointer shrink-0"
        >
          <Logo size="sm" className="h-[36px] md:h-[52px]" />
        </button>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-3 xl:gap-4">
          {navLinks.map(renderDesktopItem)}
        </div>

        {/* Right Nav Utilities */}
        <div className="flex items-center gap-4">
          {/* Dynamic Search box */}
          <div className="relative flex items-center">
            {searchOpen && (
              <input
                type="text"
                placeholder="Buscar drone ou peça..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-40 md:w-56 h-9 px-4 mr-2 text-xs rounded-full bg-brand-surface border border-brand-border text-brand-white focus:outline-none focus:border-blue-primary transition-all font-sans"
              />
            )}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-brand-white hover:text-blue-primary transition-colors cursor-pointer rounded-full hover:bg-white/5"
              id="search-btn"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          {/* User Button */}
          <Link
            href="/conta"
            aria-label="Minha conta"
            title="Minha conta"
            className="hidden h-10 items-center gap-2 rounded-full px-3 text-brand-white transition-colors hover:bg-white/5 hover:text-blue-primary sm:flex"
            id="user-btn"
          >
            <User className="w-5 h-5" />
            <span className="hidden text-xs font-semibold xl:inline">Minha conta</span>
          </Link>

          {/* Cart Trigger with green accent badge */}
          <button
            onClick={onCartToggle}
            className="p-2 text-brand-white hover:text-blue-primary transition-colors relative cursor-pointer rounded-full hover:bg-white/5"
            id="cart-trigger"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartItemsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-green-accent rounded-full text-[9px] font-bold text-[#05070B] flex items-center justify-center animate-pulse shadow-[0_0_8px_#00E676]" id="cart-badge">
                {cartItemsCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-brand-white hover:text-blue-primary transition-colors cursor-pointer"
            id="menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-4 right-4 mt-2 z-40 lg:hidden p-6 rounded-3xl glass-panel-strong flex flex-col gap-4 animate-in fade-in duration-300" id="mobile-menu">
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
          </div>
        </div>
      )}
    </header>
  );
}
