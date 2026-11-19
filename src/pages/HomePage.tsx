import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { Product } from '../types';
import { LuxuryImage } from '../components/LuxuryImage';
import { ProductCard } from '../components/ProductCard';

type CollectionTab = 'featured' | 'New Arrivals' | 'Best Sellers' | 'Trending Products' | 'Discount Products';

export function HomePage() {
  const { navigate, banners, setPageMeta } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CollectionTab>('featured');

  useEffect(() => {
    setPageMeta(
      'DIAMOND STORE — Your Style, Your Statement.',
      'Discover premium menswear, native tailored outfits, handcrafted footwear, and signature accessories at DIAMOND STORE.'
    );
    apiFetch<{ products: Product[] }>('/api/products')
      .then((res) => setProducts(res.products))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [setPageMeta]);

  const heroBanner =
    banners.find((b) => b.placement === 'hero') || {
      title: 'Your Style, Your Statement.',
      subtitle:
        'Discover premium clothing, stylish footwear and accessories designed to elevate your everyday look.',
      imageUrl: '/src/assets/images/hero_diamond_atelier_1795101494057.jpg',
      buttonText: 'SHOP NOW',
      buttonLink: '/shop',
    };

  const promoBanner =
    banners.find((b) => b.placement === 'promo') || {
      title: 'The Signature Footwear Edit',
      subtitle:
        'Hand-lasted Italian calfskin boots, burnished suede loafers, and minimalist obsidian sneakers.',
      imageUrl: '/src/assets/images/banner_footwear_edit_1795101496867.jpg',
      buttonText: 'EXPLORE COLLECTION',
      buttonLink: '/shoes',
    };

  const filteredProducts = products
    .filter((p) => {
      if (activeTab === 'featured') return p.isFeatured;
      if (activeTab === 'Best Sellers') return p.isBestSeller || p.collectionTags?.includes('Best Sellers');
      if (activeTab === 'Discount Products') return Boolean(p.discountPrice) || p.collectionTags?.includes('Discount Products');
      return p.collectionTags?.includes(activeTab);
    })
    .slice(0, 6);

  const visibleProducts = filteredProducts.length > 0 ? filteredProducts : products.slice(0, 6);

  return (
    <main>
      {/* 1. Hero Campaign */}
      <section className="bg-[#111111] text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-5 px-6 sm:px-10 lg:px-12 py-16 lg:py-24 flex flex-col justify-center space-y-6">
            <p className="text-xs tracking-[0.22em] text-[#D4AF37] uppercase font-medium">
              Victoria Island · Lagos
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.06] text-white">
              DIAMOND STORE
            </h1>
            <p className="font-display text-2xl italic text-[#D4AF37]">
              “{heroBanner.title}”
            </p>
            <p className="text-sm sm:text-base text-white/75 leading-relaxed max-w-md">
              {heroBanner.subtitle}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(heroBanner.buttonLink || '/shop')}
                className="px-7 py-3.5 bg-[#D4AF37] text-[#111111] text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#e1be4d] transition-colors whitespace-nowrap shrink-0"
              >
                {heroBanner.buttonText || 'SHOP NOW'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/new-arrivals')}
                className="px-7 py-3.5 border border-white/30 text-white text-xs font-semibold tracking-[0.16em] uppercase hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
              >
                EXPLORE COLLECTION
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 relative min-h-[360px] lg:min-h-[580px] bg-[#1a1a1a]">
            <LuxuryImage
              src={heroBanner.imageUrl}
              alt="DIAMOND STORE Luxury Menswear Campaign"
              eager
              className="w-full h-full object-cover object-center lg:absolute lg:inset-0"
            />
          </div>
        </div>
      </section>

      {/* 2. Shop by Category */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase font-medium">
              Curated Wardrobe
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111] mt-1">
              Shop by Category
            </h2>
          </div>
          <a
            href="/shop"
            onClick={(e) => {
              e.preventDefault();
              navigate('/shop');
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#111111] hover:text-[#8C6D14]"
          >
            <span>View All Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {[
            {
              title: "Men's Clothing",
              subtitle: 'Senator Native Wears · Corporate Shirts · Tailored Blazers',
              image: '/src/assets/images/prod_agbada_onyx_1795101497844.jpg',
              path: '/mens-clothing',
            },
            {
              title: 'Footwear',
              subtitle: 'Calfskin Sneakers · Suede Loafers · Chelsea Boots',
              image: '/src/assets/images/prod_loafers_cognac_1795101496526.jpg',
              path: '/shoes',
            },
            {
              title: "Men's Accessories",
              subtitle: 'Chronograph Watches · Polarized Aviators · Leather Bags',
              image: '/src/assets/images/prod_chronograph_watch_1795101497542.jpg',
              path: '/accessories',
            },
          ].map((cat) => (
            <a
              key={cat.path}
              href={cat.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(cat.path);
              }}
              className="group relative aspect-[4/3] bg-[#F5F5F5] overflow-hidden block border border-black/8"
            >
              <LuxuryImage
                src={cat.image}
                alt={cat.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-6 flex flex-col justify-end">
                <h3 className="font-display text-2xl font-semibold text-white">
                  {cat.title}
                </h3>
                <p className="text-xs text-white/80 mt-1">{cat.subtitle}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 3. Featured & Curated Collections Grid */}
      <section className="bg-[#F5F5F5] py-16 lg:py-20 border-y border-black/6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase font-medium">
                Signature Releases
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111] mt-1">
                Curated Selections
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-black/10">
              {(
                [
                  { id: 'featured', label: 'Featured' },
                  { id: 'New Arrivals', label: 'New Arrivals' },
                  { id: 'Best Sellers', label: 'Best Sellers' },
                  { id: 'Trending Products', label: 'Trending' },
                  { id: 'Discount Products', label: 'Special Offers' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-[#111111] text-white'
                      : 'text-[#111111]/70 hover:text-[#111111]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white h-80 animate-pulse border border-black/8" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-8 py-3.5 bg-[#111111] text-white text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#222222] transition-colors"
            >
              View Entire Collection
            </button>
          </div>
        </div>
      </section>

      {/* 4. Promotional Editorial Banner + Client Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#111111] text-white items-stretch">
          <div className="lg:col-span-7 relative min-h-[280px] lg:min-h-[380px]">
            <LuxuryImage
              src={promoBanner.imageUrl}
              alt={promoBanner.title}
              className="w-full h-full object-cover lg:absolute lg:inset-0"
            />
          </div>
          <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-center space-y-5">
            <p className="text-xs tracking-[0.18em] text-[#D4AF37] uppercase">
              Craftsmanship
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white">
              {promoBanner.title}
            </h2>
            <p className="text-sm text-white/75 leading-relaxed">
              {promoBanner.subtitle}
            </p>
            <div>
              <button
                type="button"
                onClick={() => navigate(promoBanner.buttonLink || '/shoes')}
                className="px-6 py-3 bg-[#D4AF37] text-[#111111] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#e1be4d] transition-colors"
              >
                {promoBanner.buttonText || 'EXPLORE COLLECTION'}
              </button>
            </div>
          </div>
        </div>

        {/* Client Testimonials */}
        <div>
          <div className="mb-8">
            <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase font-medium">
              Client Voices
            </p>
            <h2 className="font-display text-3xl font-semibold text-[#111111] mt-1">
              Trusted Across Lagos, Abuja & London
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  'Switched my boardroom shirts and Senator sets exclusively to DIAMOND STORE. Same-day Victoria Island courier arrived neatly pressed in garment bags.',
                author: 'Olumide Balogun',
                role: 'Managing Partner, Balogun Capital · Ikoyi, Lagos',
              },
              {
                quote:
                  'The cognac suede loafers pair effortlessly with both kaftans and navy tailoring. Fit was accurate to EU sizing on the first order.',
                author: 'Chukwuemeka Eze',
                role: 'Principal Architect · Maitama, Abuja',
              },
              {
                quote:
                  'Ordered the weekender leather bag and chronograph to London via DHL Express—arrived in 4 business days with full tracking updates.',
                author: 'Damilola Adesina',
                role: 'Investment Director · Canary Wharf, UK',
              },
            ].map((item) => (
              <blockquote
                key={item.author}
                className="p-6 bg-[#F5F5F5] border border-black/8 flex flex-col justify-between gap-5"
              >
                <p className="text-sm text-[#111111]/85 leading-relaxed">
                  “{item.quote}”
                </p>
                <footer className="pt-4 border-t border-black/8">
                  <div className="text-sm font-semibold text-[#111111]">
                    {item.author}
                  </div>
                  <div className="text-xs text-[#111111]/55 mt-0.5">
                    {item.role}
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
