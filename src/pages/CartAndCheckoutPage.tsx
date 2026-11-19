import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Landmark, Minus, Plus, Trash2, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatNaira } from '../lib/api';
import type { Order, PublicPaymentMethod } from '../types';
import { LuxuryImage } from '../components/LuxuryImage';

export function CartPage() {
  const { cart, cartSubtotal, updateCartQty, removeFromCart, navigate, settings } =
    useStore();
  const currency = settings?.currencySymbol || '₦';

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111] mb-8">
        Shopping Bag
      </h1>

      {cart.length === 0 ? (
        <div className="p-14 bg-[#F5F5F5] border border-black/8 text-center space-y-4">
          <p className="text-sm text-[#111111]/65">Your shopping bag is empty.</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-7 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
          >
            Browse Collections
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-4">
            {cart.map((item) => (
              <div
                key={`${item.productId}-${item.size}-${item.color}`}
                className="flex gap-5 p-4 border border-black/10 bg-white"
              >
                <div className="w-24 h-28 bg-[#F5F5F5] shrink-0 overflow-hidden">
                  <LuxuryImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-[#111111]">{item.name}</h3>
                      <p className="text-xs text-[#111111]/55 mt-1">
                        {[item.size, item.color].filter(Boolean).join(' · ')} · SKU{' '}
                        {item.sku}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-sm">
                      {formatNaira(item.unitPrice * item.quantity, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <div className="inline-flex items-center border border-black/15">
                      <button
                        type="button"
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
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-mono tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
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
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        removeFromCart(item.productId, item.size, item.color)
                      }
                      className="inline-flex items-center gap-1.5 text-xs text-[#111111]/60 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4">
            <div className="p-6 bg-[#F5F5F5] border border-black/10 space-y-4">
              <h2 className="font-display text-2xl font-semibold">Order Summary</h2>
              <div className="flex justify-between text-sm pt-2 border-t border-black/10">
                <span className="text-[#111111]/70">Subtotal</span>
                <span className="font-mono tabular-nums font-semibold">
                  {formatNaira(cartSubtotal, currency)}
                </span>
              </div>
              <p className="text-xs text-[#111111]/60">
                Delivery fees by state and active coupon codes are applied at checkout.
              </p>
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className="w-full py-3.5 bg-[#111111] text-white text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#222222]"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function CheckoutPage() {
  const {
    cart,
    cartSubtotal,
    clearCart,
    shippingZones,
    customer,
    customerToken,
    settings,
    navigate,
    showToast,
    setPageMeta,
  } = useStore();

  const currency = settings?.currencySymbol || '₦';
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  // Dynamic Payment Methods fetched directly from backend!
  const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState<number | null>(null);
  const [loadingGateways, setLoadingGateways] = useState(true);

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    order: Order;
    payment: {
      provider: string;
      displayName: string;
      reference: string;
      instructions?: string;
      bankDetails?: {
        bankName?: string;
        accountName?: string;
        accountNumber?: string;
        instructions?: string;
      };
    };
  } | null>(null);

  useEffect(() => {
    setPageMeta('Checkout — DIAMOND STORE', 'Complete your DIAMOND STORE luxury order.');
  }, [setPageMeta]);

  useEffect(() => {
    if (customer) {
      setCustomerName((prev) => prev || customer.fullName || '');
      setCustomerEmail((prev) => prev || customer.email || '');
      setCustomerPhone((prev) => prev || customer.phone || '');
      if (customer.defaultAddress) {
        setStreet((prev) => prev || customer.defaultAddress?.street || '');
        setCity((prev) => prev || customer.defaultAddress?.city || '');
        setShippingState((prev) => prev || customer.defaultAddress?.state || '');
        setCountry((prev) => prev || customer.defaultAddress?.country || 'Nigeria');
        setPostalCode((prev) => prev || customer.defaultAddress?.postalCode || '');
      }
    }
  }, [customer]);

  useEffect(() => {
    if (!shippingState && shippingZones.length > 0) {
      setShippingState(shippingZones[0].stateName);
    }
  }, [shippingZones, shippingState]);

  // Retrieve active payment methods dynamically whenever shipping state changes
  useEffect(() => {
    setLoadingGateways(true);
    const qs = shippingState ? `?state=${encodeURIComponent(shippingState)}` : '';
    apiFetch<{ paymentMethods: PublicPaymentMethod[] }>(
      `/api/checkout/payment-methods${qs}`
    )
      .then((res) => {
        setPaymentMethods(res.paymentMethods);
        const def =
          res.paymentMethods.find((m) => m.isDefault) || res.paymentMethods[0];
        setSelectedGatewayId(def ? def.id : null);
      })
      .catch((err) => console.error('Failed to load payment methods:', err))
      .finally(() => setLoadingGateways(false));
  }, [shippingState]);

  const activeZone = shippingZones.find((z) => z.stateName === shippingState);
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const discountedSub = Math.max(0, cartSubtotal - discountAmount);
  const shippingFee = activeZone
    ? activeZone.freeDeliveryThreshold !== null &&
      discountedSub >= activeZone.freeDeliveryThreshold
      ? 0
      : activeZone.fee
    : 0;

  const selectedMethod = paymentMethods.find((m) => m.id === selectedGatewayId);
  const codFee =
    selectedMethod?.provider === 'cash_on_delivery'
      ? Number(selectedMethod.codDetails?.additionalFee || 0)
      : 0;
  const grandTotal = discountedSub + shippingFee + codFee;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await apiFetch<{ code: string; discountAmount: number }>(
        '/api/checkout/validate-coupon',
        {
          method: 'POST',
          body: JSON.stringify({ code: couponCode, subtotal: cartSubtotal }),
        }
      );
      setAppliedCoupon({ code: res.code, discountAmount: res.discountAmount });
      showToast(`Coupon ${res.code} applied (-${formatNaira(res.discountAmount, currency)})`);
    } catch (err: unknown) {
      setAppliedCoupon(null);
      showToast(err instanceof Error ? err.message : 'Invalid coupon', 'error');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGatewayId) {
      showToast('No active payment method selected.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        order: Order;
        payment: {
          provider: string;
          displayName: string;
          reference: string;
          requiresRedirect: boolean;
          authorizationUrl?: string;
          instructions?: string;
          bankDetails?: {
            bankName?: string;
            accountName?: string;
            accountNumber?: string;
            instructions?: string;
          };
        };
      }>('/api/checkout/orders', {
        method: 'POST',
        token: customerToken,
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress: {
            street,
            city,
            state: shippingState,
            country,
            postalCode,
          },
          shippingState,
          paymentGatewayId: selectedGatewayId,
          couponCode: appliedCoupon?.code,
          notes,
          items: cart.map((it) => ({
            productId: it.productId,
            size: it.size,
            color: it.color,
            quantity: it.quantity,
          })),
        }),
      });

      clearCart();

      if (res.payment.requiresRedirect && res.payment.authorizationUrl) {
        window.location.href = res.payment.authorizationUrl;
        return;
      }

      setCompletedOrder({ order: res.order, payment: res.payment });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Checkout failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (completedOrder) {
    const { order, payment } = completedOrder;
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="p-8 bg-[#F5F5F5] border border-black/10 space-y-4">
          <div className="flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Order Recorded
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#111111]">
            Thank You, {order.customerName}
          </h1>
          <p className="text-sm text-[#111111]/75">
            Order <span className="font-mono font-semibold">{order.orderNumber}</span> has
            been placed with <span className="font-medium">{payment.displayName}</span>.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-black/10 text-xs">
            <div>
              <div className="text-[#111111]/55">Order Number</div>
              <div className="font-mono font-semibold mt-1">{order.orderNumber}</div>
            </div>
            <div>
              <div className="text-[#111111]/55">Total Amount</div>
              <div className="font-mono tabular-nums font-semibold mt-1">
                {formatNaira(order.totalAmount, currency)}
              </div>
            </div>
            <div>
              <div className="text-[#111111]/55">Payment Status</div>
              <div className="font-medium capitalize mt-1">{order.paymentStatus}</div>
            </div>
            <div>
              <div className="text-[#111111]/55">Order Status</div>
              <div className="font-medium mt-1">{order.orderStatus}</div>
            </div>
          </div>

          {payment.provider === 'bank_transfer' && payment.bankDetails && (
            <div className="p-5 bg-white border border-[#D4AF37] space-y-2 text-sm">
              <h2 className="font-semibold text-[#111111]">
                Corporate Bank Transfer Instructions
              </h2>
              <p>
                Bank Name:{' '}
                <span className="font-semibold">{payment.bankDetails.bankName}</span>
              </p>
              <p>
                Account Name:{' '}
                <span className="font-semibold">{payment.bankDetails.accountName}</span>
              </p>
              <p>
                Account Number:{' '}
                <span className="font-mono font-semibold text-base">
                  {payment.bankDetails.accountNumber}
                </span>
              </p>
              <p className="text-xs text-[#111111]/70 pt-1">
                {payment.bankDetails.instructions} Use reference{' '}
                <span className="font-mono font-semibold">{order.orderNumber}</span>.
              </p>
            </div>
          )}

          {payment.provider === 'cash_on_delivery' && (
            <div className="p-5 bg-white border border-black/10 text-sm text-[#111111]/80">
              {payment.instructions}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                navigate(`/track-order?order=${encodeURIComponent(order.orderNumber)}`)
              }
              className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
            >
              Track Order Status
            </button>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-6 py-3 border border-black/20 text-xs font-semibold uppercase tracking-wider"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl font-semibold">Checkout</h1>
        <p className="text-sm text-[#111111]/65">
          Add items to your shopping bag before checking out.
        </p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-7 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
        >
          Shop Collection
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111] mb-8">
        Checkout
      </h1>

      <form
        onSubmit={handlePlaceOrder}
        className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start"
      >
        <div className="lg:col-span-7 space-y-8">
          {/* Contact & Shipping */}
          <section className="p-6 border border-black/10 space-y-4">
            <h2 className="font-display text-2xl font-semibold">
              1. Client & Delivery Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Phone / WhatsApp Number *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Delivery Region / State *
                </label>
                <select
                  required
                  value={shippingState}
                  onChange={(e) => setShippingState(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm bg-white focus:outline-none focus:border-[#111111]"
                >
                  {shippingZones.map((z) => (
                    <option key={z.id} value={z.stateName}>
                      {z.stateName} ({formatNaira(z.fee, currency)} · {z.estimatedDays})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="House number, street name, estate or landmark"
                className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Tailoring or Delivery Note (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate access instructions, preferred delivery window..."
                className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
          </section>

          {/* Dynamic Payment Method Selection */}
          <section className="p-6 border border-black/10 space-y-4">
            <h2 className="font-display text-2xl font-semibold">
              2. Payment Method
            </h2>

            {loadingGateways ? (
              <div className="h-24 bg-[#F5F5F5] animate-pulse" />
            ) : paymentMethods.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 text-xs text-amber-900">
                No active payment gateways are currently enabled for this region. Please
                contact the store administrator.
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const selected = selectedGatewayId === method.id;
                  return (
                    <label
                      key={method.id}
                      className={`block p-4 border cursor-pointer transition-colors ${
                        selected
                          ? 'border-[#111111] bg-[#F5F5F5]'
                          : 'border-black/15 bg-white hover:border-black/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentGateway"
                          checked={selected}
                          onChange={() => setSelectedGatewayId(method.id)}
                          className="mt-1 accent-[#111111]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm text-[#111111] flex items-center gap-2">
                              {method.kind === 'manual' ? (
                                <Landmark className="w-4 h-4 text-[#8C6D14]" />
                              ) : method.kind === 'cod' ? (
                                <Truck className="w-4 h-4 text-[#8C6D14]" />
                              ) : (
                                <CreditCard className="w-4 h-4 text-[#8C6D14]" />
                              )}
                              {method.displayName}
                            </span>
                            {method.mode === 'test' && (
                              <span className="text-[11px] font-mono text-amber-700">
                                Test Mode
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#111111]/60 mt-1">
                            {method.description}
                          </p>

                          {selected &&
                            method.provider === 'bank_transfer' &&
                            method.bankDetails && (
                              <div className="mt-3 p-3 bg-white border border-black/10 text-xs space-y-1">
                                <div>
                                  <span className="text-[#111111]/60">Bank:</span>{' '}
                                  <span className="font-semibold">
                                    {method.bankDetails.bankName}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[#111111]/60">Account:</span>{' '}
                                  <span className="font-semibold">
                                    {method.bankDetails.accountName}
                                  </span>{' '}
                                  ·{' '}
                                  <span className="font-mono font-semibold">
                                    {method.bankDetails.accountNumber}
                                  </span>
                                </div>
                                {method.bankDetails.instructions && (
                                  <p className="text-[#111111]/70 pt-1">
                                    {method.bankDetails.instructions}
                                  </p>
                                )}
                              </div>
                            )}

                          {selected &&
                            method.provider === 'cash_on_delivery' &&
                            Number(method.codDetails?.additionalFee || 0) > 0 && (
                              <p className="mt-2 text-xs text-[#8C6D14] font-medium">
                                Cash on Delivery service fee:{' '}
                                {formatNaira(
                                  Number(method.codDetails?.additionalFee || 0),
                                  currency
                                )}
                              </p>
                            )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right: Order Totals & Coupon */}
        <aside className="lg:col-span-5 p-6 bg-[#F5F5F5] border border-black/10 space-y-5 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl font-semibold">Order Summary</h2>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {cart.map((it) => (
              <div
                key={`${it.productId}-${it.size}-${it.color}`}
                className="flex justify-between text-xs gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#111111] truncate">{it.name}</div>
                  <div className="text-[#111111]/60">
                    Qty {it.quantity} {it.size ? `· ${it.size}` : ''}
                  </div>
                </div>
                <span className="font-mono tabular-nums font-medium shrink-0">
                  {formatNaira(it.unitPrice * it.quantity, currency)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-3 border-t border-black/10">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Coupon code (e.g. DIAMOND10)"
              className="flex-1 px-3 py-2 bg-white border border-black/15 text-xs uppercase focus:outline-none"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase"
            >
              Apply
            </button>
          </div>

          <div className="space-y-2 pt-3 border-t border-black/10 text-sm">
            <div className="flex justify-between">
              <span className="text-[#111111]/70">Subtotal</span>
              <span className="font-mono tabular-nums">
                {formatNaira(cartSubtotal, currency)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-800">
                <span>Discount ({appliedCoupon?.code})</span>
                <span className="font-mono tabular-nums">
                  -{formatNaira(discountAmount, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#111111]/70">
                Delivery ({activeZone?.estimatedDays || 'Standard'})
              </span>
              <span className="font-mono tabular-nums">
                {shippingFee === 0 ? 'Complimentary' : formatNaira(shippingFee, currency)}
              </span>
            </div>
            {codFee > 0 && (
              <div className="flex justify-between">
                <span className="text-[#111111]/70">Cash on Delivery Fee</span>
                <span className="font-mono tabular-nums">
                  {formatNaira(codFee, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-black/15 text-base font-semibold">
              <span>Total</span>
              <span className="font-mono tabular-nums">
                {formatNaira(grandTotal, currency)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedGatewayId}
            className="w-full py-4 bg-[#111111] text-white text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#222222] transition-colors disabled:opacity-45"
          >
            {submitting
              ? 'Processing Order...'
              : `Complete Order · ${formatNaira(grandTotal, currency)}`}
          </button>
        </aside>
      </form>
    </main>
  );
}

export function PaymentVerifyPage() {
  const { searchParams, navigate, settings } = useStore();
  const [status, setStatus] = useState<'verifying' | 'paid' | 'failed'>('verifying');
  const [message, setMessage] = useState('Verifying transaction directly with payment provider...');
  const [order, setOrder] = useState<Order | null>(null);
  const currency = settings?.currencySymbol || '₦';

  useEffect(() => {
    const ref = searchParams.get('reference') || searchParams.get('tx_ref') || '';
    const sessionId = searchParams.get('session_id') || '';
    if (!ref) {
      setStatus('failed');
      setMessage('Missing transaction reference.');
      return;
    }

    const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    apiFetch<{ verified: boolean; message: string; order: Order }>(
      `/api/payments/verify/${encodeURIComponent(ref)}${qs}`
    )
      .then((res) => {
        setOrder(res.order);
        setMessage(res.message);
        setStatus(res.verified ? 'paid' : 'failed');
      })
      .catch((err) => {
        setStatus('failed');
        setMessage(err instanceof Error ? err.message : 'Verification failed.');
      });
  }, [searchParams]);

  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-5">
      <h1 className="font-display text-3xl font-semibold text-[#111111]">
        {status === 'verifying'
          ? 'Verifying Payment...'
          : status === 'paid'
            ? 'Payment Verified'
            : 'Payment Pending or Unverified'}
      </h1>
      <p className="text-sm text-[#111111]/75">{message}</p>
      {order && (
        <div className="p-5 bg-[#F5F5F5] border border-black/10 text-left text-xs space-y-1.5">
          <div>
            Order Number: <span className="font-mono font-semibold">{order.orderNumber}</span>
          </div>
          <div>
            Total Paid:{' '}
            <span className="font-mono font-semibold">
              {formatNaira(order.totalAmount, currency)}
            </span>
          </div>
          <div>Status: {order.orderStatus}</div>
        </div>
      )}
      <div className="flex justify-center gap-3 pt-2">
        {order && (
          <button
            type="button"
            onClick={() => navigate(`/track-order?order=${order.orderNumber}`)}
            className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
          >
            Track Order
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-3 border border-black/20 text-xs font-semibold uppercase tracking-wider"
        >
          Back to Store
        </button>
      </div>
    </main>
  );
}
