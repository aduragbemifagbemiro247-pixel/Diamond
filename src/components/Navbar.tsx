import React, { useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function Navbar() {
  const {
    currentPath,
    navigate,
    settings,
    cartCount,
    setCartOpen,
    customer,
    wishlistIds,
  } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = [
    { label: 'Shop All', path: '/shop' },
    { label: "Men's Clothing", path: '/mens-clothing' },
    { label: 'Shoes', path: '/shoes' },
    { label: 'Accessories', path: '/accessories' },
    { label: 'Track Order', path: '/track-order' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-black/8 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Menu"
            className="md:hidden p-2 -ml-2 text-[#111111] hover:text-[#8C6D14] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="font-display text-2xl font-semibold tracking-[0.14em] text-[#111111] whitespace-nowrap shrink-0"
          >
            {settings?.storeName || 'DIAMOND STORE'}
          </a>
        </div>

        {/* Zone 2: Clean Single-Line Text Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#111111]/75">
          {navItems.map((item) => {
            const active = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b ${
                  active
                    ? 'text-[#111111] border-[#D4AF37]'
                    : 'border-transparent hover:text-[#111111] hover:border-black/25'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Compact Primary Action Cluster */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search Products"
            className="p-2 text-[#111111] hover:text-[#8C6D14] transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/wishlist')}
            aria-label="Wishlist"
            className="hidden sm:inline-flex relative p-2 text-[#111111] hover:text-[#8C6D14] transition-colors"
          >
            <Heart className="w-4 h-4" />
            {wishlistIds.length > 0 && (
              <span className="ml-1 text-xs font-mono tabular-nums text-[#8C6D14]">
                {wishlistIds.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate(customer ? '/account' : '/login')}
            aria-label={customer ? 'My Account' : 'Sign In'}
            className="p-2 text-[#111111] hover:text-[#8C6D14] transition-colors"
          >
            <User className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-white text-xs font-medium tracking-wider hover:bg-[#222222] transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Bag</span>
            <span className="font-mono tabular-nums text-[#D4AF37]">({cartCount})</span>
          </button>
        </div>
      </div>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="border-t border-black/8 bg-[#F5F5F5]">
          <form
            onSubmit={handleSearch}
            className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3"
          >
            <Search className="w-4 h-4 text-[#111111]/50 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Senator wears, leather loafers, wristwatches, SKU..."
              className="flex-1 bg-transparent text-sm text-[#111111] placeholder:text-[#111111]/45 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#111111] text-white text-xs font-medium whitespace-nowrap shrink-0"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close Search"
              className="p-1.5 text-[#111111]/60 hover:text-[#111111]"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-black/10 bg-white px-4 py-4 space-y-1">
          {[
            ...navItems,
            { label: 'New Arrivals', path: '/new-arrivals' },
            { label: 'Best Sellers', path: '/best-sellers' },
            { label: 'Wishlist', path: '/wishlist' },
            { label: customer ? 'My Account' : 'Sign In / Register', path: customer ? '/account' : '/login' },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.path);
                setMobileOpen(false);
              }}
              className="block py-2.5 px-2 text-sm font-medium text-[#111111] border-b border-black/5"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
