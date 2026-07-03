import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ReceiptText, Search, User, ShoppingCart, Menu, X } from 'lucide-react';
import Logo from '../ui/Logo';
import type { StorefrontCategory } from '../../types';
import { getPrimaryStorefrontCategories } from '../home/category-display';

interface NavbarProps {
  categories: StorefrontCategory[];
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
    return getPrimaryStorefrontCategories(categories).map((category) => ({
      label: category.name,
      value: category.slug,
    }));
  }, [categories]);

  const handleLinkClick = (categoryValue: string | null) => {
    onCategorySelect(categoryValue);
    setMobileMenuOpen(false);
    // Smooth scroll to product grid
    const section = document.getElementById('catalogo');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
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
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((link) => {
            const isActive = activeCategory === link.value;
            return (
              <button
                key={link.label}
                onClick={() => handleLinkClick(link.value)}
                className={`text-[14px] font-medium tracking-wide transition-all duration-300 relative py-1 cursor-pointer hover:text-white ${
                  isActive ? 'text-white' : 'text-brand-muted'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-primary rounded-full shadow-[0_0_8px_#1E3DFF]"></span>
                )}
              </button>
            );
          })}
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
              const isActive = activeCategory === link.value;
              return (
                <button
                  key={link.label}
                  onClick={() => handleLinkClick(link.value)}
                  className={`w-full text-left py-3 px-4 rounded-xl text-[15px] font-medium transition-colors ${
                    isActive ? 'bg-blue-primary/15 text-white border-l-4 border-blue-primary' : 'text-brand-white hover:bg-white/5'
                  }`}
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
