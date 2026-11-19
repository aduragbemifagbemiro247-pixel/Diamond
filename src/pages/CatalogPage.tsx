import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { Product } from '../types';
import { ProductCard } from '../components/ProductCard';

interface CatalogPageProps {
  mode: 'all' | 'mens-clothing' | 'shoes' | 'accessories' | 'new-arrivals' | 'best-sellers' | 'category';
  categorySlug?: string;
}

export function CatalogPage({ mode, categorySlug }: CatalogPageProps) {
  const { categories, searchParams, navigate, setPageMeta } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCat, setSelectedCat] = useState(categorySlug || '');
  const [sort, setSort] = useState('newest');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    setSelectedCat(categorySlug || '');
  }, [categorySlug]);

  const titleMap: Record<CatalogPageProps['mode'], string> = {
    all: 'Shop All Collections',
    'mens-clothing': "Men's Clothing",
    shoes: 'Footwear & Shoes',
    accessories: "Men's Accessories",
    'new-arrivals': 'New Arrivals',
    'best-sellers': 'Best Sellers',
    category:
      categories.find((c) => c.slug === categorySlug)?.name || 'Category Collection',
  };

  useEffect(() => {
    setPageMeta(
      `${titleMap[mode]} — DIAMOND STORE`,
      `Browse ${titleMap[mode]} from DIAMOND STORE. Premium menswear, footwear and accessories delivered nationwide.`
    );
  }, [mode, categorySlug, categories, setPageMeta]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCat) {
      params.set('category', selectedCat);
    } else if (
      mode === 'mens-clothing' ||
      mode === 'shoes' ||
      mode === 'accessories'
    ) {
      params.set('group', mode);
    } else if (mode === 'new-arrivals') {
      params.set('collection', 'New Arrivals');
    } else if (mode === 'best-sellers') {
      params.set('bestSeller', 'true');
    }

    if (search.trim()) params.set('search', search.trim());
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sort) params.set('sort', sort);

    apiFetch<{ products: Product[] }>(`/api/products?${params.toString()}`)
      .then((res) => setProducts(res.products))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [mode, selectedCat, search, maxPrice, sort]);

  const relevantCategories = categories.filter((c) => {
    if (mode === 'mens-clothing' || mode === 'shoes' || mode === 'accessories') {
      return c.parentGroup === mode;
    }
    return true;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="border-b border-black/10 pb-8 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase font-medium">
            DIAMOND STORE Catalog
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111] mt-1">
            {titleMap[mode]}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#111111]/45 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by keyword or SKU..."
              className="pl-9 pr-4 py-2 border border-black/15 text-sm bg-white focus:outline-none focus:border-[#111111] w-60"
            />
          </div>

          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            aria-label="Filter by maximum price"
            className="px-3 py-2 border border-black/15 text-sm bg-white focus:outline-none"
          >
            <option value="">All Prices</option>
            <option value="50000">Under ₦50,000</option>
            <option value="100000">Under ₦100,000</option>
            <option value="150000">Under ₦150,000</option>
            <option value="250000">Under ₦250,000</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
            className="px-3 py-2 border border-black/15 text-sm bg-white focus:outline-none"
          >
            <option value="newest">Newest Arrivals</option>
            <option value="popular">Popularity</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8">
        <span className="inline-flex items-center gap-1.5 text-xs text-[#111111]/60 mr-2 shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Category:
        </span>
        <button
          type="button"
          onClick={() => {
            setSelectedCat('');
            if (mode === 'category') navigate('/shop');
          }}
          className={`px-3.5 py-1.5 text-xs font-medium border whitespace-nowrap shrink-0 transition-colors ${
            !selectedCat
              ? 'bg-[#111111] text-white border-[#111111]'
              : 'bg-white text-[#111111]/75 border-black/15 hover:border-[#111111]'
          }`}
        >
          All
        </button>
        {relevantCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCat(cat.slug)}
            className={`px-3.5 py-1.5 text-xs font-medium border whitespace-nowrap shrink-0 transition-colors ${
              selectedCat === cat.slug
                ? 'bg-[#111111] text-white border-[#111111]'
                : 'bg-white text-[#111111]/75 border-black/15 hover:border-[#111111]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-[#F5F5F5] h-80 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center bg-[#F5F5F5] border border-black/8 space-y-4">
          <p className="font-display text-2xl text-[#111111]">
            No pieces matched your current filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCat('');
              setSearch('');
              setMaxPrice('');
            }}
            className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
