/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { WhatsAppFloat } from './components/WhatsAppFloat';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import {
  CartPage,
  CheckoutPage,
  PaymentVerifyPage,
} from './pages/CartAndCheckoutPage';
import {
  AccountPage,
  CustomerAuthPage,
  TrackOrderPage,
  WishlistPage,
} from './pages/CustomerAuthAndAccountPages';
import { StaticPage } from './pages/StaticPages';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

function AppRouter() {
  const { currentPath } = useStore();
  const path = currentPath.replace(/\/+$/, '') || '/';

  // Separate Admin Routes (isolated from customer storefront layout)
  if (path === '/admin/login') {
    return <AdminLoginPage />;
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminDashboardPage />;
  }

  let pageView: React.ReactNode;

  if (path === '/') {
    pageView = <HomePage />;
  } else if (path === '/shop') {
    pageView = <CatalogPage mode="all" />;
  } else if (path === '/mens-clothing') {
    pageView = <CatalogPage mode="mens-clothing" />;
  } else if (path === '/shoes') {
    pageView = <CatalogPage mode="shoes" />;
  } else if (path === '/accessories') {
    pageView = <CatalogPage mode="accessories" />;
  } else if (path === '/new-arrivals') {
    pageView = <CatalogPage mode="new-arrivals" />;
  } else if (path === '/best-sellers') {
    pageView = <CatalogPage mode="best-sellers" />;
  } else if (path.startsWith('/category/')) {
    const slug = path.slice('/category/'.length);
    pageView = <CatalogPage mode="category" categorySlug={slug} />;
  } else if (path.startsWith('/product/')) {
    const slug = path.slice('/product/'.length);
    pageView = <ProductDetailPage slug={slug} />;
  } else if (path === '/cart') {
    pageView = <CartPage />;
  } else if (path === '/checkout') {
    pageView = <CheckoutPage />;
  } else if (path === '/checkout/verify') {
    pageView = <PaymentVerifyPage />;
  } else if (path === '/login') {
    pageView = <CustomerAuthPage mode="login" />;
  } else if (path === '/register') {
    pageView = <CustomerAuthPage mode="register" />;
  } else if (path === '/forgot-password') {
    pageView = <CustomerAuthPage mode="forgot" />;
  } else if (path === '/reset-password') {
    pageView = <CustomerAuthPage mode="reset" />;
  } else if (path === '/account') {
    pageView = <AccountPage />;
  } else if (path === '/wishlist') {
    pageView = <WishlistPage />;
  } else if (path === '/track-order') {
    pageView = <TrackOrderPage />;
  } else if (path === '/about') {
    pageView = <StaticPage page="about" />;
  } else if (path === '/contact') {
    pageView = <StaticPage page="contact" />;
  } else if (path === '/faq') {
    pageView = <StaticPage page="faq" />;
  } else if (path === '/privacy') {
    pageView = <StaticPage page="privacy" />;
  } else if (path === '/terms') {
    pageView = <StaticPage page="terms" />;
  } else {
    pageView = <HomePage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111111]">
      <Navbar />
      <div className="flex-1">{pageView}</div>
      <Footer />
      <CartDrawer />
      <WhatsAppFloat />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppRouter />
    </StoreProvider>
  );
}
