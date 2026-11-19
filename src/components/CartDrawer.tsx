import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatNaira } from '../lib/api';
import { LuxuryImage } from './LuxuryImage';

export function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    cartSubtotal,
    updateCartQty,
    removeFromCart,
    navigate,
    settings,
  } = useStore();

  if (!cartOpen) return null;

  const currency = settings?.currencySymbol || '₦';

  return (
    <div className="fixed inset-0 z-50 flex justify-end no-print">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => setCartOpen(false)}
      />
      <aside className="relative w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-black/10">
        <div className="px-6 py-5 border-b border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
            <h2 className="font-display text-xl font-semibold text-[#111111]">
              Shopping Bag
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Close Shopping Bag"
            className="p-2 text-[#111111]/60 hover:text-[#111111]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-sm text-[#111111]/60">
                Your shopping bag is currently empty.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/shop');
                }}
                className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold tracking-wider uppercase"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={`${item.productId}-${item.size}-${item.color}`}
                className="flex gap-4 pb-5 border-b border-black/8"
              >
                <div className="w-20 h-24 bg-[#F5F5F5] shrink-0 overflow-hidden">
                  <LuxuryImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <a
                      href={`/product/${item.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setCartOpen(false);
                        navigate(`/product/${item.slug}`);
                      }}
                      className="text-sm font-medium text-[#111111] hover:underline line-clamp-1"
                    >
                      {item.name}
                    </a>
                    <p className="text-xs text-[#111111]/55 mt-0.5">
                      {[item.size, item.color].filter(Boolean).join(' · ') || item.sku}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="inline-flex items-center border border-black/15">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          updateCartQty(
                            item.productId,
                            item.size,
                            item.color,
                            item.quantity - 1
                          )
                        }
                        className="p-1.5 hover:bg-[#F5F5F5]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 text-xs font-mono tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() =>
                          updateCartQty(
                            item.productId,
                            item.size,
                            item.color,
                            item.quantity + 1
                          )
                        }
                        className="p-1.5 hover:bg-[#F5F5F5]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono tabular-nums font-medium text-[#111111]">
                        {formatNaira(item.unitPrice * item.quantity, currency)}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() =>
                          removeFromCart(item.productId, item.size, item.color)
                        }
                        className="text-[#111111]/40 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 border-t border-black/10 bg-[#F5F5F5] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#111111]/70">Subtotal</span>
              <span className="text-lg font-mono tabular-nums font-semibold text-[#111111]">
                {formatNaira(cartSubtotal, currency)}
              </span>
            </div>
            <p className="text-xs text-[#111111]/55">
              Delivery fees and coupon discounts are calculated at checkout.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/cart');
                }}
                className="py-3 px-4 border border-[#111111] text-[#111111] text-xs font-semibold tracking-wider uppercase hover:bg-white transition-colors"
              >
                View Bag
              </button>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/checkout');
                }}
                className="py-3 px-4 bg-[#111111] text-white text-xs font-semibold tracking-wider uppercase hover:bg-[#222222] transition-colors"
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
