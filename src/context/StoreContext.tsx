import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import type {
  Banner,
  CartItem,
  Category,
  CustomerUser,
  Product,
  ShippingZone,
  StoreSettings,
} from '../types';

interface ToastState {
  id: number;
  message: string;
  tone: 'default' | 'error';
}

interface StoreContextValue {
  currentPath: string;
  searchParams: URLSearchParams;
  navigate: (path: string) => void;
  setPageMeta: (title: string, description?: string) => void;
  settings: StoreSettings | null;
  categories: Category[];
  banners: Banner[];
  shippingZones: ShippingZone[];
  loadingBootstrap: boolean;
  refreshBootstrap: () => Promise<void>;
  // Cart
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (item: CartItem) => void;
  updateCartQty: (productId: number, size: string, color: string, qty: number) => void;
  removeFromCart: (productId: number, size: string, color: string) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartCount: number;
  // Customer Auth
  customer: CustomerUser | null;
  customerToken: string | null;
  authLoading: boolean;
  loginCustomerWithToken: (token: string, user: CustomerUser) => void;
  loginWithGoogle: () => Promise<void>;
  logoutCustomer: () => Promise<void>;
  refreshCustomerProfile: () => Promise<void>;
  // Wishlist
  wishlistIds: number[];
  toggleWishlist: (product: Product) => Promise<void>;
  // Toast
  showToast: (message: string, tone?: 'default' | 'error') => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [locationHref, setLocationHref] = useState(() => window.location.pathname + window.location.search);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem('dmnd_cart_v1');
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);

  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('dmnd_cust_token');
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, tone: 'default' | 'error' = 'default') => {
    const id = Date.now();
    setToast({ id, message, tone });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3400);
  }, []);

  // Persist cart in sessionStorage only as transient checkout convenience across payment redirects
  useEffect(() => {
    try {
      sessionStorage.setItem('dmnd_cart_v1', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    const handlePop = () => {
      setLocationHref(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path === window.location.pathname + window.location.search) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.history.pushState({}, '', path);
    setLocationHref(path);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const setPageMeta = useCallback((title: string, description?: string) => {
    document.title = title;
    if (description) {
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute('content', description);
      const ogDescEl = document.querySelector('meta[property="og:description"]');
      if (ogDescEl) ogDescEl.setAttribute('content', description);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await apiFetch<{
        settings: StoreSettings | null;
        categories: Category[];
        banners: Banner[];
        shippingZones: ShippingZone[];
      }>('/api/bootstrap');
      setSettings(data.settings);
      setCategories(data.categories);
      setBanners(data.banners);
      setShippingZones(data.shippingZones);
    } catch (err) {
      console.error('Bootstrap load error:', err);
    } finally {
      setLoadingBootstrap(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  const loadWishlist = useCallback(async (token: string) => {
    try {
      const data = await apiFetch<{ items: Product[] }>('/api/customer/wishlist', {
        token,
      });
      setWishlistIds(data.items.map((p) => p.id));
    } catch {
      // ignore
    }
  }, []);

  const refreshCustomerProfile = useCallback(async () => {
    if (!customerToken) return;
    try {
      const data = await apiFetch<{ user: CustomerUser }>('/api/customer/profile', {
        token: customerToken,
      });
      setCustomer(data.user);
      await loadWishlist(customerToken);
    } catch {
      setCustomer(null);
      setCustomerToken(null);
      sessionStorage.removeItem('dmnd_cust_token');
    }
  }, [customerToken, loadWishlist]);

  // Listen to Firebase Auth state & also restore first-party customer token
  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setCustomerToken(idToken);
          const data = await apiFetch<{ user: CustomerUser }>('/api/customer/profile', {
            token: idToken,
          });
          if (active) {
            setCustomer(data.user);
            await loadWishlist(idToken);
          }
        } catch {
          // ignore
        } finally {
          if (active) setAuthLoading(false);
        }
      } else {
        const storedToken = sessionStorage.getItem('dmnd_cust_token');
        if (storedToken) {
          try {
            const data = await apiFetch<{ user: CustomerUser }>('/api/customer/profile', {
              token: storedToken,
            });
            if (active) {
              setCustomerToken(storedToken);
              setCustomer(data.user);
              await loadWishlist(storedToken);
            }
          } catch {
            sessionStorage.removeItem('dmnd_cust_token');
            if (active) {
              setCustomerToken(null);
              setCustomer(null);
            }
          }
        }
        if (active) setAuthLoading(false);
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, [loadWishlist]);

  const loginCustomerWithToken = useCallback(
    (token: string, user: CustomerUser) => {
      sessionStorage.setItem('dmnd_cust_token', token);
      setCustomerToken(token);
      setCustomer(user);
      loadWishlist(token);
    },
    [loadWishlist]
  );

  const loginWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await result.user.getIdToken();
    setCustomerToken(idToken);
    const data = await apiFetch<{ user: CustomerUser }>('/api/customer/profile', {
      token: idToken,
    });
    setCustomer(data.user);
    await loadWishlist(idToken);
    showToast(`Welcome back, ${data.user.fullName || data.user.email}`);
  }, [loadWishlist, showToast]);

  const logoutCustomer = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    sessionStorage.removeItem('dmnd_cust_token');
    setCustomerToken(null);
    setCustomer(null);
    setWishlistIds([]);
    showToast('Signed out of your account.');
  }, [showToast]);

  // Cart Actions
  const addToCart = useCallback(
    (item: CartItem) => {
      setCart((prev) => {
        const idx = prev.findIndex(
          (p) =>
            p.productId === item.productId &&
            p.size === item.size &&
            p.color === item.color
        );
        if (idx > -1) {
          const next = [...prev];
          const updatedQty = Math.min(
            item.maxStock,
            next[idx].quantity + item.quantity
          );
          next[idx] = { ...next[idx], quantity: updatedQty };
          return next;
        }
        return [...prev, item];
      });
      setCartOpen(true);
      showToast(`Added ${item.name} to bag`);
    },
    [showToast]
  );

  const updateCartQty = useCallback(
    (productId: number, size: string, color: string, qty: number) => {
      if (qty <= 0) {
        setCart((prev) =>
          prev.filter(
            (p) =>
              !(p.productId === productId && p.size === size && p.color === color)
          )
        );
        return;
      }
      setCart((prev) =>
        prev.map((p) =>
          p.productId === productId && p.size === size && p.color === color
            ? { ...p, quantity: Math.min(p.maxStock, qty) }
            : p
        )
      );
    },
    []
  );

  const removeFromCart = useCallback(
    (productId: number, size: string, color: string) => {
      setCart((prev) =>
        prev.filter(
          (p) =>
            !(p.productId === productId && p.size === size && p.color === color)
        )
      );
    },
    []
  );

  const clearCart = useCallback(() => setCart([]), []);

  const cartSubtotal = cart.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const cartCount = cart.reduce((sum, it) => sum + it.quantity, 0);

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!customerToken) {
        showToast('Sign in to save pieces to your wishlist.', 'error');
        navigate('/login');
        return;
      }
      const exists = wishlistIds.includes(product.id);
      if (exists) {
        await apiFetch(`/api/customer/wishlist/${product.id}`, {
          method: 'DELETE',
          token: customerToken,
        });
        setWishlistIds((prev) => prev.filter((id) => id !== product.id));
        showToast(`Removed ${product.name} from wishlist`);
      } else {
        await apiFetch('/api/customer/wishlist', {
          method: 'POST',
          token: customerToken,
          body: JSON.stringify({ productId: product.id }),
        });
        setWishlistIds((prev) => [...prev, product.id]);
        showToast(`Saved ${product.name} to wishlist`);
      }
    },
    [customerToken, wishlistIds, navigate, showToast]
  );

  const [currentPath, queryStr = ''] = locationHref.split('?');
  const searchParams = new URLSearchParams(queryStr);

  return (
    <StoreContext.Provider
      value={{
        currentPath: currentPath || '/',
        searchParams,
        navigate,
        setPageMeta,
        settings,
        categories,
        banners,
        shippingZones,
        loadingBootstrap,
        refreshBootstrap,
        cart,
        cartOpen,
        setCartOpen,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        cartSubtotal,
        cartCount,
        customer,
        customerToken,
        authLoading,
        loginCustomerWithToken,
        loginWithGoogle,
        logoutCustomer,
        refreshCustomerProfile,
        wishlistIds,
        toggleWishlist,
        showToast,
      }}
    >
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 text-sm font-medium shadow-lg transition-all border ${
            toast.tone === 'error'
              ? 'bg-[#111111] text-white border-red-500'
              : 'bg-[#111111] text-white border-[#D4AF37]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
