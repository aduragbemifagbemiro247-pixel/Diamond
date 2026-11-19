import { Heart, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatNaira } from '../lib/api';
import type { Product } from '../types';
import { LuxuryImage } from './LuxuryImage';

export function ProductCard({ product }: { product: Product }) {
  const { navigate, addToCart, wishlistIds, toggleWishlist, settings } = useStore();
  const currency = settings?.currencySymbol || '₦';
  const isWishlisted = wishlistIds.includes(product.id);
  const effectivePrice = product.discountPrice ?? product.regularPrice;
  const outOfStock = product.stockQuantity <= 0;

  return (
    <article className="group flex flex-col bg-white border border-black/8 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-[#F5F5F5] overflow-hidden">
        <a
          href={`/product/${product.slug}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/product/${product.slug}`);
          }}
          className="block w-full h-full"
        >
          <LuxuryImage
            src={product.mainImage}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </a>
        <button
          type="button"
          onClick={() => toggleWishlist(product)}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 p-2 bg-white/90 text-[#111111] hover:text-[#8C6D14] transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${isWishlisted ? 'fill-[#D4AF37] text-[#D4AF37]' : ''}`}
          />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <div className="text-xs text-[#111111]/55 flex items-center gap-1.5">
            <span>{product.categoryName || 'Collection'}</span>
            {outOfStock ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-red-700 font-medium">Sold Out</span>
              </>
            ) : product.discountPrice ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#8C6D14] font-medium">Offer</span>
              </>
            ) : null}
          </div>

          <h3 className="font-sans text-base font-semibold text-[#111111] leading-snug line-clamp-1">
            <a
              href={`/product/${product.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/product/${product.slug}`);
              }}
              className="hover:underline"
            >
              {product.name}
            </a>
          </h3>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-black/6">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono tabular-nums font-semibold text-[#111111]">
              {formatNaira(effectivePrice, currency)}
            </span>
            {product.discountPrice && (
              <span className="text-xs font-mono tabular-nums text-[#111111]/45 line-through">
                {formatNaira(product.regularPrice, currency)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={outOfStock}
            onClick={() =>
              addToCart({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                sku: product.sku,
                imageUrl: product.mainImage,
                unitPrice: effectivePrice,
                size: product.sizes?.[0] || '',
                color: product.colors?.[0] || '',
                quantity: 1,
                maxStock: product.stockQuantity,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-white text-xs font-medium hover:bg-[#222222] transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-3 h-3 text-[#D4AF37]" />
            <span>{outOfStock ? 'Out of Stock' : 'Add'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
