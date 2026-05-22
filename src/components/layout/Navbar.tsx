import React, { useState, useEffect } from 'react';
import { Search, User, ShoppingCart, Menu, X } from 'lucide-react';
import Logo from '../ui/Logo';

interface NavbarProps {
  cartItemsCount: number;
  onCartToggle: () => void;
  activeCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  onNavigateToHome: () => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
}

export default function Navbar({
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

  const navLinks = [
    { label: 'Todos', value: null },
    { label: 'Drones', value: 'Drones' },
    { label: 'Peças', value: 'Peças' },
    { label: 'Acessórios', value: 'Acessórios' },
    { label: 'Baterias', value: 'Baterias' },
    { label: 'Kits', value: 'Kits e Combos' },
  ];

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
        <button onClick={onNavigateToHome} className="focus:outline-none cursor-pointer shrink-0">
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
          <button className="hidden sm:flex p-2 text-brand-white hover:text-blue-primary transition-colors cursor-pointer rounded-full hover:bg-white/5" id="user-btn">
            <User className="w-5 h-5" />
          </button>

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

          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-sm text-brand-muted">Acessar minha conta</span>
            <button className="p-2 bg-brand-surface rounded-full border border-brand-border text-brand-white">
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
