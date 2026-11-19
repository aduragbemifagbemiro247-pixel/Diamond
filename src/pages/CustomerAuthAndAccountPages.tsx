import React, { useEffect, useState } from 'react';
import { LogOut, Package, Search, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatNaira } from '../lib/api';
import type { CustomerUser, Order, Product } from '../types';
import { ProductCard } from '../components/ProductCard';

export function CustomerAuthPage({
  mode,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset';
}) {
  const {
    navigate,
    loginCustomerWithToken,
    loginWithGoogle,
    showToast,
    setPageMeta,
  } = useStore();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const titles = {
      login: 'Sign In — DIAMOND STORE',
      register: 'Create Account — DIAMOND STORE',
      forgot: 'Reset Password — DIAMOND STORE',
      reset: 'Set New Password — DIAMOND STORE',
    };
    setPageMeta(titles[mode]);
  }, [mode, setPageMeta]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch<{ token: string; user: CustomerUser }>(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }
        );
        loginCustomerWithToken(res.token, res.user);
        showToast(`Welcome back, ${res.user.fullName || res.user.email}`);
        navigate('/account');
      } else if (mode === 'register') {
        const res = await apiFetch<{ token: string; user: CustomerUser }>(
          '/api/auth/register',
          {
            method: 'POST',
            body: JSON.stringify({ fullName, email, phone, password }),
          }
        );
        loginCustomerWithToken(res.token, res.user);
        showToast('Account created. Welcome to DIAMOND STORE.');
        navigate('/account');
      } else if (mode === 'forgot') {
        const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        showToast(res.message);
        navigate('/reset-password');
      } else {
        const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, newPassword: password }),
        });
        showToast(res.message);
        navigate('/login');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Authentication error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/account');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Google Sign-In cancelled.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="p-8 border border-black/12 bg-white space-y-6">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase font-medium">
            Client Access
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#111111]">
            {mode === 'login'
              ? 'Sign In'
              : mode === 'register'
                ? 'Create Account'
                : mode === 'forgot'
                  ? 'Reset Password'
                  : 'Set New Password'}
          </h1>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="w-full py-3 px-4 border border-black/20 text-xs font-semibold tracking-wider uppercase hover:bg-[#F5F5F5] transition-colors"
            >
              Continue with Google
            </button>
            <div className="relative text-center text-xs text-[#111111]/45">
              <span className="bg-white px-3 relative z-10">or with email</span>
              <div className="absolute inset-x-0 top-1/2 border-t border-black/10" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
            </>
          )}

          {mode === 'reset' && (
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Reset Token
              </label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-black/15 text-sm font-mono focus:outline-none focus:border-[#111111]"
              />
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                {mode === 'reset' ? 'New Password' : 'Password'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-black/15 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#111111] text-white text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#222222] disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Create Account'
                  : mode === 'forgot'
                    ? 'Send Reset Instructions'
                    : 'Update Password'}
          </button>
        </form>

        <div className="pt-2 border-t border-black/10 text-xs text-[#111111]/70 flex flex-wrap justify-between gap-2">
          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="hover:text-[#111111] underline"
              >
                Create an account
              </button>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="hover:text-[#111111] underline"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:text-[#111111] underline"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export function AccountPage() {
  const {
    customer,
    customerToken,
    authLoading,
    navigate,
    logoutCustomer,
    refreshCustomerProfile,
    shippingZones,
    settings,
    showToast,
    setPageMeta,
  } = useStore();

  const [tab, setTab] = useState<'orders' | 'profile' | 'security'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = settings?.currencySymbol || '₦';

  useEffect(() => {
    setPageMeta('My Account — DIAMOND STORE');
  }, [setPageMeta]);

  useEffect(() => {
    if (!authLoading && !customerToken) {
      navigate('/login');
    }
  }, [authLoading, customerToken, navigate]);

  useEffect(() => {
    if (customer) {
      setFullName(customer.fullName || '');
      setPhone(customer.phone || '');
      setStreet(customer.defaultAddress?.street || '');
      setCity(customer.defaultAddress?.city || '');
      setStateName(customer.defaultAddress?.state || '');
    }
  }, [customer]);

  useEffect(() => {
    if (!customerToken) return;
    apiFetch<{ orders: Order[] }>('/api/customer/orders', { token: customerToken })
      .then((res) => setOrders(res.orders))
      .catch(() => {});
  }, [customerToken]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToken) return;
    setSaving(true);
    try {
      await apiFetch('/api/customer/profile', {
        method: 'PUT',
        token: customerToken,
        body: JSON.stringify({
          fullName,
          phone,
          defaultAddress: { street, city, state: stateName, country: 'Nigeria' },
        }),
      });
      await refreshCustomerProfile();
      showToast('Profile and default address saved.');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToken) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/customer/change-password', {
        method: 'POST',
        token: customerToken,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast(res.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Password update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !customer) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="h-40 bg-[#F5F5F5] animate-pulse" />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-6">
        <div>
          <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase">
            Client Suite
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#111111] mt-1">
            {customer.fullName || customer.email}
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">{customer.email}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            logoutCustomer();
            navigate('/');
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-black/20 text-xs font-semibold uppercase tracking-wider hover:bg-[#F5F5F5] self-start"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="flex gap-2 border-b border-black/10">
        {(
          [
            { id: 'orders', label: `Order History (${orders.length})` },
            { id: 'profile', label: 'Profile & Delivery Address' },
            { id: 'security', label: 'Change Password' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-[#111111]/55 hover:text-[#111111]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="p-12 bg-[#F5F5F5] text-center space-y-4">
              <p className="text-sm text-[#111111]/65">
                You have not placed any orders yet.
              </p>
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
              >
                Explore Store
              </button>
            </div>
          ) : (
            orders.map((ord) => (
              <div key={ord.id} className="p-6 border border-black/10 bg-white space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 pb-3">
                  <div>
                    <div className="font-mono text-sm font-semibold">
                      {ord.orderNumber}
                    </div>
                    <div className="text-xs text-[#111111]/55">
                      {new Date(ord.createdAt).toLocaleDateString()} · {ord.orderStatus} ·{' '}
                      Payment: {ord.paymentStatus}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono tabular-nums font-semibold">
                      {formatNaira(ord.totalAmount, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/track-order?order=${encodeURIComponent(ord.orderNumber)}`)
                      }
                      className="px-3 py-1.5 border border-black/20 text-xs font-medium hover:bg-[#F5F5F5]"
                    >
                      Track
                    </button>
                  </div>
                </div>
                {ord.items && ord.items.length > 0 && (
                  <div className="space-y-2 text-xs text-[#111111]/80">
                    {ord.items.map((it) => (
                      <div key={it.id} className="flex justify-between">
                        <span>
                          {it.productName} × {it.quantity}{' '}
                          {it.size ? `(${it.size})` : ''}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatNaira(it.totalPrice, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-xl p-6 bg-[#F5F5F5] border border-black/10 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-[#111111]/70 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-black/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#111111]/70 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-black/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#111111]/70 mb-1">
              Default Street Address
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-black/15 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-black/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Delivery State / Zone
              </label>
              <select
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-black/15 text-sm"
              >
                <option value="">Select Zone</option>
                {shippingZones.map((z) => (
                  <option key={z.id} value={z.stateName}>
                    {z.stateName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}

      {tab === 'security' && (
        <form
          onSubmit={handleChangePassword}
          className="max-w-md p-6 bg-[#F5F5F5] border border-black/10 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-[#111111]/70 mb-1">
              Current Password (leave blank if Google account)
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-black/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#111111]/70 mb-1">
              New Password (min 6 characters)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-black/15 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
          >
            Update Password
          </button>
        </form>
      )}
    </main>
  );
}

export function WishlistPage() {
  const { customerToken, authLoading, navigate, setPageMeta } = useStore();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageMeta('Wishlist — DIAMOND STORE');
  }, [setPageMeta]);

  useEffect(() => {
    if (authLoading) return;
    if (!customerToken) {
      setLoading(false);
      return;
    }
    apiFetch<{ items: Product[] }>('/api/customer/wishlist', { token: customerToken })
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, [customerToken, authLoading]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
        Saved Wishlist
      </h1>

      {!customerToken && !authLoading ? (
        <div className="p-14 bg-[#F5F5F5] border border-black/8 text-center space-y-4">
          <p className="text-sm text-[#111111]/70">
            Sign in to sync and view your saved pieces across devices.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-7 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
          >
            Sign In
          </button>
        </div>
      ) : loading ? (
        <div className="h-64 bg-[#F5F5F5] animate-pulse" />
      ) : items.length === 0 ? (
        <div className="p-14 bg-[#F5F5F5] border border-black/8 text-center space-y-4">
          <p className="text-sm text-[#111111]/70">Your wishlist is empty.</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-7 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
          >
            Discover Collection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

export function TrackOrderPage() {
  const { searchParams, settings, setPageMeta } = useStore();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ order: Order; items: any[] } | null>(null);
  const currency = settings?.currencySymbol || '₦';

  useEffect(() => {
    setPageMeta('Track Order — DIAMOND STORE');
  }, [setPageMeta]);

  const fetchTrack = async (num: string, mail?: string) => {
    if (!num.trim()) return;
    setLoading(true);
    setError('');
    try {
      const qs = mail?.trim() ? `?email=${encodeURIComponent(mail.trim())}` : '';
      const res = await apiFetch<{ order: Order; items: any[] }>(
        `/api/orders/track/${encodeURIComponent(num.trim())}${qs}`
      );
      setResult(res);
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Order not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get('order');
    if (initial) {
      setOrderNumber(initial);
      fetchTrack(initial);
    }
  }, [searchParams]);

  const steps = ['Pending Payment', 'Paid', 'Processing', 'Ready for Dispatch', 'Shipped', 'Delivered'];
  const currentStepIdx = result ? steps.indexOf(result.order.orderStatus) : -1;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-8">
      <div className="space-y-2">
        <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase font-medium">
          Courier Tracking
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
          Track Your Order
        </h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchTrack(orderNumber, email);
        }}
        className="p-6 bg-[#F5F5F5] border border-black/10 grid grid-cols-1 sm:grid-cols-12 gap-3"
      >
        <input
          type="text"
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order Number (e.g. DMND-2026-123456)"
          className="sm:col-span-5 px-3.5 py-2.5 bg-white border border-black/15 text-sm font-mono uppercase focus:outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional verification)"
          className="sm:col-span-4 px-3.5 py-2.5 bg-white border border-black/15 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
        >
          <Search className="w-3.5 h-3.5" />
          <span>{loading ? 'Checking...' : 'Track'}</span>
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="p-6 border border-black/12 bg-white space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-4">
            <div>
              <div className="font-mono text-base font-semibold">
                {result.order.orderNumber}
              </div>
              <div className="text-xs text-[#111111]/60 mt-0.5">
                Placed on {new Date(result.order.createdAt).toLocaleDateString()} ·{' '}
                {result.order.shippingState}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-[#111111]">
                {result.order.orderStatus}
              </div>
              <div className="text-xs font-mono tabular-nums text-[#8C6D14]">
                Total: {formatNaira(result.order.totalAmount, currency)}
              </div>
            </div>
          </div>

          {result.order.trackingNumber && (
            <div className="p-3 bg-[#F5F5F5] text-xs flex items-center gap-2">
              <Package className="w-4 h-4 text-[#8C6D14]" />
              <span>Courier Tracking ID:</span>
              <span className="font-mono font-semibold">
                {result.order.trackingNumber}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {steps.map((s, idx) => {
              const done = currentStepIdx >= idx;
              return (
                <div
                  key={s}
                  className={`p-2.5 border text-center text-[11px] font-medium ${
                    done
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-[#F5F5F5] text-[#111111]/45 border-black/8'
                  }`}
                >
                  {s}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-2 border-t border-black/10 text-xs">
            {result.items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span>
                  {it.productName} × {it.quantity} {it.size ? `(${it.size})` : ''}
                </span>
                <span className="font-mono tabular-nums">
                  {formatNaira(it.totalPrice, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
