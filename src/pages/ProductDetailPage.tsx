import React, { useEffect, useState } from 'react';
import { Heart, Minus, Plus, ShieldCheck, Star, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatNaira } from '../lib/api';
import type { Product, ProductReview } from '../types';
import { LuxuryImage } from '../components/LuxuryImage';
import { ProductCard } from '../components/ProductCard';

export function ProductDetailPage({ slug }: { slug: string }) {
  const {
    navigate,
    addToCart,
    toggleWishlist,
    wishlistIds,
    settings,
    customer,
    customerToken,
    showToast,
    setPageMeta,
  } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [qty, setQty] = useState(1);

  // Review Form
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const currency = settings?.currencySymbol || '₦';

  useEffect(() => {
    setLoading(true);
    apiFetch<{
      product: Product;
      reviews: ProductReview[];
      relatedProducts: Product[];
    }>(`/api/products/${encodeURIComponent(slug)}`)
      .then((res) => {
        setProduct(res.product);
        setReviews(res.reviews);
        setRelated(res.relatedProducts);
        setActiveImage(res.product.mainImage);
        setSelectedSize(res.product.sizes?.[0] || '');
        setSelectedColor(res.product.colors?.[0] || '');
        setQty(1);
        setPageMeta(
          res.product.metaTitle || `${res.product.name} — DIAMOND STORE`,
          res.product.metaDescription || res.product.description.slice(0, 155)
        );
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug, setPageMeta]);

  useEffect(() => {
    if (customer?.fullName) setReviewName(customer.fullName);
  }, [customer]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 aspect-[4/3] bg-[#F5F5F5] animate-pulse" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-8 bg-[#F5F5F5] w-3/4 animate-pulse" />
            <div className="h-6 bg-[#F5F5F5] w-1/3 animate-pulse" />
            <div className="h-28 bg-[#F5F5F5] w-full animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-24 text-center space-y-5">
        <h1 className="font-display text-3xl font-semibold">Piece Not Found</h1>
        <p className="text-sm text-[#111111]/65">
          This item may have sold out or moved to an archived collection.
        </p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
        >
          Return to Catalog
        </button>
      </main>
    );
  }

  const gallery = Array.from(
    new Set([product.mainImage, ...(product.images || [])].filter(Boolean))
  );
  const effectivePrice = product.discountPrice ?? product.regularPrice;
  const variantKey = `${selectedSize} / ${selectedColor}`.trim();
  const variantAvailable =
    product.variantStock &&
    variantKey !== '/' &&
    typeof product.variantStock[variantKey] === 'number'
      ? product.variantStock[variantKey]
      : product.stockQuantity;
  const maxAvailable = Math.min(product.stockQuantity, variantAvailable);
  const isWishlisted = wishlistIds.includes(product.id);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await apiFetch<{ review: ProductReview }>(
        `/api/products/${product.id}/reviews`,
        {
          method: 'POST',
          token: customerToken,
          body: JSON.stringify({
            customerName: reviewName,
            rating: reviewRating,
            comment: reviewComment,
          }),
        }
      );
      setReviews((prev) => [res.review, ...prev]);
      setReviewComment('');
      showToast('Thank you for your review.');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to submit review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 space-y-16">
      {/* Breadcrumb */}
      <nav className="text-xs text-[#111111]/60 flex items-center gap-2">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="hover:text-[#111111]"
        >
          Home
        </a>
        <span>/</span>
        <a
          href="/shop"
          onClick={(e) => {
            e.preventDefault();
            navigate('/shop');
          }}
          className="hover:text-[#111111]"
        >
          {product.categoryName || 'Collection'}
        </a>
        <span>/</span>
        <span className="text-[#111111] font-medium">{product.name}</span>
      </nav>

      {/* Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left: Sticky Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/3] bg-[#F5F5F5] border border-black/8 overflow-hidden">
            <LuxuryImage
              src={activeImage || product.mainImage}
              alt={product.name}
              eager
              className="w-full h-full object-cover"
            />
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {gallery.map((img) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`aspect-[4/3] bg-[#F5F5F5] overflow-hidden border transition-colors ${
                    activeImage === img
                      ? 'border-[#111111]'
                      : 'border-black/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <LuxuryImage
                    src={img}
                    alt={`${product.name} alternate view`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Sticky Purchase Details */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div className="space-y-2 border-b border-black/10 pb-5">
            <div className="text-xs text-[#111111]/60 flex items-center gap-2">
              <span>{product.categoryName || 'Collection'}</span>
              <span>·</span>
              <span className="font-mono">SKU: {product.sku}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-[#111111]">
                <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                <span className="font-mono tabular-nums">{product.avgRating || 5}</span>
                <span>({reviews.length})</span>
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl font-mono tabular-nums font-semibold text-[#111111]">
                {formatNaira(effectivePrice, currency)}
              </span>
              {product.discountPrice && (
                <span className="text-base font-mono tabular-nums text-[#111111]/45 line-through">
                  {formatNaira(product.regularPrice, currency)}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-[#111111]/80 leading-relaxed">
            {product.description}
          </p>

          {/* Size Selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#111111]">
                  Select Size
                </span>
                <span className="text-[#111111]/60">{selectedSize}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`min-w-[48px] px-3.5 py-2 text-xs font-medium border transition-colors ${
                      selectedSize === sz
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#111111] border-black/15 hover:border-[#111111]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Selector */}
          {product.colors && product.colors.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#111111]">
                  Colour
                </span>
                <span className="text-[#111111]/60">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    className={`px-3.5 py-2 text-xs font-medium border transition-colors ${
                      selectedColor === col
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#111111] border-black/15 hover:border-[#111111]'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock & Quantity + Buy Actions */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-medium">
              {maxAvailable > 5 ? (
                <span className="text-emerald-800">
                  In Stock — Ready for immediate dispatch ({maxAvailable} available)
                </span>
              ) : maxAvailable > 0 ? (
                <span className="text-amber-700">
                  Low Stock — Only {maxAvailable} left in this selection
                </span>
              ) : (
                <span className="text-red-700">Currently Out of Stock</span>
              )}
            </div>

            <div className="flex items-stretch gap-3">
              <div className="inline-flex items-center border border-black/20">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 py-3 hover:bg-[#F5F5F5]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-mono tabular-nums">{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(Math.max(1, maxAvailable), q + 1))}
                  className="px-3 py-3 hover:bg-[#F5F5F5]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={maxAvailable <= 0}
                onClick={() =>
                  addToCart({
                    productId: product.id,
                    slug: product.slug,
                    name: product.name,
                    sku: product.sku,
                    imageUrl: product.mainImage,
                    unitPrice: effectivePrice,
                    size: selectedSize,
                    color: selectedColor,
                    quantity: qty,
                    maxStock: maxAvailable,
                  })
                }
                className="flex-1 py-3.5 px-6 bg-[#111111] text-white text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#222222] transition-colors disabled:opacity-40"
              >
                {maxAvailable > 0 ? 'Add to Shopping Bag' : 'Out of Stock'}
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                aria-label="Toggle wishlist"
                className="px-4 border border-black/20 hover:border-[#111111] transition-colors"
              >
                <Heart
                  className={`w-4 h-4 ${isWishlisted ? 'fill-[#D4AF37] text-[#D4AF37]' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-black/10 space-y-2.5 text-xs text-[#111111]/70">
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-[#8C6D14] shrink-0" />
              <span>Same-day Lagos delivery · Insured nationwide & DHL Express shipping</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#8C6D14] shrink-0" />
              <span>14-day complimentary size exchange guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <section className="border-t border-black/10 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-6">
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Client Reviews ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-[#111111]/60">
              No reviews yet. Be the first to share your fit and fabric impression.
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 bg-[#F5F5F5] border border-black/8 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111111]">
                      {rev.customerName}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-[#8C6D14]">
                      {'★'.repeat(rev.rating)}
                      {'☆'.repeat(5 - rev.rating)}
                    </span>
                  </div>
                  <p className="text-sm text-[#111111]/80 leading-relaxed">
                    {rev.comment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <form
            onSubmit={handleReviewSubmit}
            className="p-6 bg-[#F5F5F5] border border-black/8 space-y-4"
          >
            <h3 className="font-display text-xl font-semibold text-[#111111]">
              Write a Review
            </h3>
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Your Name
              </label>
              <input
                type="text"
                required
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Rating
              </label>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-white border border-black/15 text-sm focus:outline-none"
              >
                <option value={5}>5 — Exceptional</option>
                <option value={4}>4 — Very Good</option>
                <option value={3}>3 — Good</option>
                <option value={2}>2 — Fair</option>
                <option value={1}>1 — Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Comment
              </label>
              <textarea
                rows={3}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share details on tailoring, sizing, and material quality..."
                className="w-full px-3.5 py-2 bg-white border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="w-full py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#222222]"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="border-t border-black/10 pt-12 space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111111]">
            Complete the Look
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
