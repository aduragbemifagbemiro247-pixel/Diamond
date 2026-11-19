import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Boxes,
  CreditCard,
  Download,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  Tag,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatNaira } from '../lib/api';
import type {
  AdminUser,
  Banner,
  Category,
  Order,
  Product,
  ProductReview,
  ShippingZone,
  StoreSettings,
} from '../types';
import { PaymentGatewaysPanel } from '../components/admin/PaymentGatewaysPanel';
import {
  OrdersPanel,
  ProductsPanel,
} from '../components/admin/ProductsAndOrdersPanels';
import { LuxuryImage } from '../components/LuxuryImage';

type AdminSection =
  | 'overview'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'payment-gateways'
  | 'transactions'
  | 'coupons'
  | 'banners'
  | 'reviews'
  | 'reports'
  | 'staff'
  | 'settings';

export function AdminDashboardPage() {
  const {
    navigate,
    showToast,
    categories,
    shippingZones,
    refreshBootstrap,
    setPageMeta,
  } = useStore();

  const [adminToken, setAdminToken] = useState<string | null>(() =>
    sessionStorage.getItem('dmnd_admin_token')
  );
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);

  // Overview state
  const [overview, setOverview] = useState<any>(null);

  // Auxiliary section states
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [adminSettings, setAdminSettings] = useState<StoreSettings | null>(null);
  const [adminCategories, setAdminCategories] = useState<Category[]>([]);
  const [adminZones, setAdminZones] = useState<ShippingZone[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);

  useEffect(() => {
    setPageMeta('Admin Operations — DIAMOND STORE');
  }, [setPageMeta]);

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin/login');
      return;
    }
    apiFetch<{ admin: AdminUser }>('/api/admin/me', { adminToken })
      .then((res) => setAdmin(res.admin))
      .catch(() => {
        sessionStorage.removeItem('dmnd_admin_token');
        setAdminToken(null);
        navigate('/admin/login');
      });
  }, [adminToken, navigate]);

  const loadSectionData = async (sec: AdminSection) => {
    if (!adminToken) return;
    try {
      if (sec === 'overview') {
        const res = await apiFetch('/api/admin/overview', { adminToken });
        setOverview(res);
      } else if (sec === 'categories') {
        const res = await apiFetch<{ categories: Category[] }>(
          '/api/admin/categories',
          { adminToken }
        );
        setAdminCategories(res.categories);
      } else if (sec === 'customers') {
        const res = await apiFetch<{ customers: any[] }>('/api/admin/customers', {
          adminToken,
        });
        setCustomers(res.customers);
      } else if (sec === 'inventory') {
        const res = await apiFetch<{ products: Product[] }>('/api/admin/products', {
          adminToken,
        });
        setInventoryProducts(res.products);
      } else if (sec === 'transactions') {
        const res = await apiFetch<{ transactions: any[] }>(
          '/api/admin/transactions',
          { adminToken }
        );
        setTransactions(res.transactions);
      } else if (sec === 'coupons') {
        const res = await apiFetch<{ coupons: any[] }>('/api/admin/coupons', {
          adminToken,
        });
        setCoupons(res.coupons);
      } else if (sec === 'banners') {
        const res = await apiFetch<{ banners: Banner[] }>('/api/admin/banners', {
          adminToken,
        });
        setBanners(res.banners);
      } else if (sec === 'reviews') {
        const res = await apiFetch<{ reviews: ProductReview[] }>(
          '/api/admin/reviews',
          { adminToken }
        );
        setReviews(res.reviews);
      } else if (sec === 'reports') {
        const res = await apiFetch('/api/admin/reports', { adminToken });
        setReports(res);
      } else if (sec === 'staff') {
        const [st, logs] = await Promise.all([
          apiFetch<{ staff: AdminUser[] }>('/api/admin/staff', { adminToken }),
          apiFetch<{ logs: any[] }>('/api/admin/audit-logs', { adminToken }),
        ]);
        setStaff(st.staff);
        setAuditLogs(logs.logs);
      } else if (sec === 'settings') {
        const [st, zn, em] = await Promise.all([
          apiFetch<{ settings: StoreSettings }>('/api/admin/settings', {
            adminToken,
          }),
          apiFetch<{ shippingZones: ShippingZone[] }>('/api/admin/shipping-zones', {
            adminToken,
          }),
          apiFetch<{ logs: any[] }>('/api/admin/email-logs', { adminToken }),
        ]);
        setAdminSettings(st.settings);
        setAdminZones(zn.shippingZones);
        setEmailLogs(em.logs);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to load section.', 'error');
    }
  };

  useEffect(() => {
    if (admin) loadSectionData(section);
  }, [section, admin]);

  const handleLogout = async () => {
    if (adminToken) {
      await apiFetch('/api/admin/logout', { method: 'POST', adminToken }).catch(() => {});
    }
    sessionStorage.removeItem('dmnd_admin_token');
    setAdminToken(null);
    navigate('/admin/login');
  };

  if (!admin || !adminToken) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-xs text-[#111111]/60">
        Verifying administrator session...
      </div>
    );
  }

  const isSuperAdmin = admin.role === 'super_admin';

  const allNavItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.ReactNode;
    roles?: AdminUser['role'][];
  }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'categories', label: 'Categories', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders', icon: <Package className="w-4 h-4" />, roles: ['super_admin', 'store_manager'] },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" />, roles: ['super_admin', 'store_manager'] },
    { id: 'inventory', label: 'Inventory', icon: <Boxes className="w-4 h-4" />, roles: ['super_admin', 'store_manager'] },
    { id: 'payment-gateways', label: 'Payment Gateways', icon: <CreditCard className="w-4 h-4" />, roles: ['super_admin', 'store_manager'] },
    { id: 'transactions', label: 'Transactions', icon: <Receipt className="w-4 h-4" />, roles: ['super_admin', 'store_manager'] },
    { id: 'coupons', label: 'Coupons & Discounts', icon: <Tag className="w-4 h-4" />, roles: ['super_admin', 'store_manager'] },
    { id: 'banners', label: 'Website Banners', icon: <ImageIcon className="w-4 h-4" />, roles: ['super_admin', 'content_manager'] },
    { id: 'reviews', label: 'Reviews', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'reports', label: 'Sales Reports', icon: <BarChart3 className="w-4 h-4" />, roles: ['super_admin', 'store_manager'] },
    { id: 'staff', label: 'Staff Management', icon: <Shield className="w-4 h-4" />, roles: ['super_admin'] },
    { id: 'settings', label: 'Store Settings', icon: <Settings className="w-4 h-4" />, roles: ['super_admin', 'content_manager'] },
  ];
  const navItems = allNavItems.filter(
    (item) => !item.roles || item.roles.includes(admin.role)
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#111111] text-white flex flex-col transition-transform lg:static lg:translate-x-0 no-print ${
          mobileMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-display text-lg font-semibold tracking-[0.12em]">
              DIAMOND STORE
            </div>
            <div className="text-[11px] text-[#D4AF37] capitalize">
              {admin.role.replace(/_/g, ' ')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenu(false)}
            className="lg:hidden p-1 text-white/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setMobileMenu(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-colors text-left ${
                section === item.id
                  ? 'bg-[#D4AF37] text-[#111111] font-semibold'
                  : 'text-white/75 hover:bg-white/8 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="block px-3.5 py-2 text-xs text-white/65 hover:text-[#D4AF37]"
          >
            View Live Storefront →
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-red-300 hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-black/10 px-4 sm:px-8 h-14 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenu(true)}
              className="lg:hidden p-1.5 text-[#111111]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs text-[#111111]/60">
              Admin Console /{' '}
              <span className="text-[#111111] font-semibold capitalize">
                {section.replace(/-/g, ' ')}
              </span>
            </span>
          </div>
          <div className="text-xs text-[#111111]/70">
            Signed in: <span className="font-semibold text-[#111111]">{admin.fullName}</span>
          </div>
        </header>

        <main className="p-4 sm:p-8 flex-1">
          {/* 1. OVERVIEW */}
          {section === 'overview' && overview && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: 'Total Revenue', val: formatNaira(overview.kpis.totalRevenue) },
                  { label: 'Total Orders', val: String(overview.kpis.totalOrders) },
                  { label: 'Pending Orders', val: String(overview.kpis.pendingOrders) },
                  { label: 'Completed', val: String(overview.kpis.completedOrders) },
                  { label: 'Customers', val: String(overview.kpis.totalCustomers) },
                  { label: 'Live Products', val: String(overview.kpis.availableProducts) },
                  { label: 'Low Stock', val: String(overview.kpis.lowStockCount), alert: overview.kpis.lowStockCount > 0 },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="p-4 bg-white border border-black/10 space-y-1"
                  >
                    <div className="text-[11px] text-[#111111]/55">{kpi.label}</div>
                    <div
                      className={`text-lg font-mono tabular-nums font-semibold ${
                        kpi.alert ? 'text-amber-700' : 'text-[#111111]'
                      }`}
                    >
                      {kpi.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* 7-Day Revenue Bar Chart & Gateway Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 p-6 bg-white border border-black/10 space-y-4">
                  <h3 className="font-display text-xl font-semibold">
                    Daily Revenue (Last 7 Days)
                  </h3>
                  <div className="h-44 flex items-end gap-3 pt-4 border-b border-black/10">
                    {(() => {
                      const maxRev = Math.max(
                        1,
                        ...overview.salesChart.map((d: any) => d.revenue)
                      );
                      return overview.salesChart.map((d: any) => {
                        const pct = Math.max(4, Math.round((d.revenue / maxRev) * 100));
                        return (
                          <div
                            key={d.date}
                            className="flex-1 flex flex-col items-center justify-end gap-2 h-full"
                          >
                            <span className="text-[10px] font-mono tabular-nums text-[#111111]/65">
                              {d.revenue > 0 ? formatNaira(d.revenue) : '₦0'}
                            </span>
                            <div
                              style={{ height: `${pct}%` }}
                              className="w-full max-w-[44px] bg-[#111111] border-t-2 border-[#D4AF37]"
                            />
                            <span className="text-[10px] font-mono text-[#111111]/55">
                              {d.date.slice(5)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="lg:col-span-4 p-6 bg-white border border-black/10 space-y-4">
                  <h3 className="font-display text-xl font-semibold">
                    Low-Stock Alerts
                  </h3>
                  {overview.lowStockProducts.length === 0 ? (
                    <p className="text-xs text-[#111111]/60">
                      All published products are sufficiently stocked.
                    </p>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      {overview.lowStockProducts.map((p: Product) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between pb-2 border-b border-black/8"
                        >
                          <span className="truncate pr-2 font-medium">{p.name}</span>
                          <span className="font-mono text-red-700 font-semibold shrink-0">
                            {p.stockQuantity} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Orders & Transactions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 bg-white border border-black/10 space-y-3">
                  <h3 className="font-display text-xl font-semibold">Recent Orders</h3>
                  {overview.recentOrders.length === 0 ? (
                    <p className="text-xs text-[#111111]/55">No orders placed yet.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {overview.recentOrders.map((o: Order) => (
                        <div
                          key={o.id}
                          className="flex justify-between py-2 border-b border-black/8"
                        >
                          <div>
                            <span className="font-mono font-semibold">{o.orderNumber}</span>{' '}
                            · {o.customerName}
                          </div>
                          <div className="font-mono tabular-nums">
                            {formatNaira(o.totalAmount)} · {o.orderStatus}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 bg-white border border-black/10 space-y-3">
                  <h3 className="font-display text-xl font-semibold">
                    Recent Transactions
                  </h3>
                  {overview.recentTransactions.length === 0 ? (
                    <p className="text-xs text-[#111111]/55">No transactions logged yet.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {overview.recentTransactions.map((t: any) => (
                        <div
                          key={t.id}
                          className="flex justify-between py-2 border-b border-black/8"
                        >
                          <div className="font-mono">{t.reference}</div>
                          <div className="font-mono tabular-nums capitalize">
                            {formatNaira(t.amount)} · {t.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. PRODUCTS */}
          {section === 'products' && (
            <ProductsPanel
              adminToken={adminToken}
              categories={categories}
              canDelete={admin.role !== 'content_manager'}
              showToast={showToast}
            />
          )}

          {/* 3. CATEGORIES */}
          {section === 'categories' && (
            <CategoriesPanel
              adminToken={adminToken}
              categories={adminCategories}
              onReload={async () => {
                await loadSectionData('categories');
                await refreshBootstrap();
              }}
              showToast={showToast}
            />
          )}

          {/* 4. ORDERS */}
          {section === 'orders' && (
            <OrdersPanel
              adminToken={adminToken}
              isSuperAdmin={isSuperAdmin}
              settings={adminSettings}
              showToast={showToast}
            />
          )}

          {/* 5. CUSTOMERS */}
          {section === 'customers' && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-semibold">
                Registered Customers ({customers.length})
              </h2>
              <div className="bg-white border border-black/10 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5 text-right">Orders</th>
                      <th className="p-3.5 text-right">Total Spent</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/8">
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td className="p-3.5">
                          <div className="font-medium">{c.fullName || 'Client'}</div>
                          <div className="text-[#111111]/55">{c.email}</div>
                        </td>
                        <td className="p-3.5 font-mono">{c.phone || '—'}</td>
                        <td className="p-3.5 text-right font-mono">{c.orderCount}</td>
                        <td className="p-3.5 text-right font-mono tabular-nums">
                          {formatNaira(c.totalSpent)}
                        </td>
                        <td className="p-3.5">
                          {c.isSuspended ? 'Suspended' : 'Active'}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/customers/${c.id}/suspend`, {
                                method: 'PUT',
                                adminToken,
                                body: JSON.stringify({ isSuspended: !c.isSuspended }),
                              });
                              showToast(
                                c.isSuspended ? 'Account reactivated.' : 'Account suspended.'
                              );
                              loadSectionData('customers');
                            }}
                            className="px-3 py-1 border border-black/20 hover:bg-[#F5F5F5]"
                          >
                            {c.isSuspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. INVENTORY */}
          {section === 'inventory' && (
            <InventoryPanel
              adminToken={adminToken}
              products={inventoryProducts}
              onReload={() => loadSectionData('inventory')}
              showToast={showToast}
            />
          )}

          {/* 7. DYNAMIC PAYMENT GATEWAYS */}
          {section === 'payment-gateways' && (
            <PaymentGatewaysPanel
              adminToken={adminToken}
              isSuperAdmin={isSuperAdmin}
              shippingZones={shippingZones}
              showToast={showToast}
            />
          )}

          {/* 8. TRANSACTIONS */}
          {section === 'transactions' && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-semibold">
                Payment Transactions ({transactions.length})
              </h2>
              <div className="bg-white border border-black/10 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Reference</th>
                      <th className="p-3.5">Order #</th>
                      <th className="p-3.5">Gateway</th>
                      <th className="p-3.5 text-right">Amount</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Provider Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/8">
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="p-3.5 font-mono">{t.reference}</td>
                        <td className="p-3.5 font-mono">{t.orderNumber}</td>
                        <td className="p-3.5 capitalize">{t.provider.replace(/_/g, ' ')}</td>
                        <td className="p-3.5 text-right font-mono tabular-nums">
                          {formatNaira(t.amount)}
                        </td>
                        <td className="p-3.5 capitalize">{t.status}</td>
                        <td className="p-3.5">
                          {t.verifiedWithProvider ? 'Verified' : 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 9. COUPONS */}
          {section === 'coupons' && (
            <CouponsPanel
              adminToken={adminToken}
              coupons={coupons}
              onReload={() => loadSectionData('coupons')}
              showToast={showToast}
            />
          )}

          {/* 10. BANNERS */}
          {section === 'banners' && (
            <BannersPanel
              adminToken={adminToken}
              banners={banners}
              onReload={async () => {
                await loadSectionData('banners');
                await refreshBootstrap();
              }}
              showToast={showToast}
            />
          )}

          {/* 11. REVIEWS */}
          {section === 'reviews' && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-semibold">
                Customer Reviews ({reviews.length})
              </h2>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 bg-white border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {r.customerName} · {r.productName} · {'★'.repeat(r.rating)}
                      </div>
                      <p className="text-[#111111]/75">{r.comment}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/reviews/${r.id}`, {
                            method: 'PUT',
                            adminToken,
                            body: JSON.stringify({ isApproved: !r.isApproved }),
                          });
                          loadSectionData('reviews');
                        }}
                        className="px-3 py-1.5 border border-black/20"
                      >
                        {r.isApproved ? 'Hide' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. SALES REPORTS */}
          {section === 'reports' && reports && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-semibold">
                  Sales Reports & Export
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    const csv = [
                      'OrderNumber,Customer,Email,Total,PaymentMethod,PaymentStatus,OrderStatus,Date',
                      ...reports.orders.map((o: Order) =>
                        [
                          o.orderNumber,
                          `"${o.customerName}"`,
                          o.customerEmail,
                          o.totalAmount,
                          o.paymentProvider,
                          o.paymentStatus,
                          o.orderStatus,
                          o.createdAt,
                        ].join(',')
                      ),
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `diamond-store-sales-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
                >
                  <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Export CSV Report</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white border border-black/10">
                  <div className="text-xs text-[#111111]/60">Total Paid Revenue</div>
                  <div className="text-xl font-mono tabular-nums font-semibold mt-1">
                    {formatNaira(reports.summary.totalRevenue)}
                  </div>
                </div>
                <div className="p-4 bg-white border border-black/10">
                  <div className="text-xs text-[#111111]/60">Total Orders</div>
                  <div className="text-xl font-mono tabular-nums font-semibold mt-1">
                    {reports.summary.totalOrders}
                  </div>
                </div>
                <div className="p-4 bg-white border border-black/10">
                  <div className="text-xs text-[#111111]/60">Paid Orders</div>
                  <div className="text-xl font-mono tabular-nums font-semibold mt-1">
                    {reports.summary.paidOrdersCount}
                  </div>
                </div>
                <div className="p-4 bg-white border border-black/10">
                  <div className="text-xs text-[#111111]/60">Avg Order Value</div>
                  <div className="text-xl font-mono tabular-nums font-semibold mt-1">
                    {formatNaira(reports.summary.averageOrderValue)}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-black/10 p-6 space-y-3">
                <h3 className="font-display text-xl font-semibold">
                  Best-Selling Products
                </h3>
                {reports.topProducts.length === 0 ? (
                  <p className="text-xs text-[#111111]/60">No unit sales recorded yet.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-black/10 text-[#111111]/60 uppercase">
                      <tr>
                        <th className="py-2">Product</th>
                        <th className="py-2">SKU</th>
                        <th className="py-2 text-right">Units Sold</th>
                        <th className="py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/8">
                      {reports.topProducts.map((tp: any) => (
                        <tr key={tp.sku}>
                          <td className="py-2.5 font-medium">{tp.productName}</td>
                          <td className="py-2.5 font-mono">{tp.sku}</td>
                          <td className="py-2.5 text-right font-mono">{tp.unitsSold}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {formatNaira(tp.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 13. STAFF MANAGEMENT & AUDIT LOGS */}
          {section === 'staff' && (
            <StaffPanel
              adminToken={adminToken}
              staff={staff}
              auditLogs={auditLogs}
              onReload={() => loadSectionData('staff')}
              showToast={showToast}
            />
          )}

          {/* 14. STORE SETTINGS & SHIPPING ZONES */}
          {section === 'settings' && adminSettings && (
            <StoreSettingsPanel
              adminToken={adminToken}
              settings={adminSettings}
              zones={adminZones}
              emailLogs={emailLogs}
              onReload={async () => {
                await loadSectionData('settings');
                await refreshBootstrap();
              }}
              showToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Helper subpanels kept modular in the same dashboard view
function CategoriesPanel({
  adminToken,
  categories,
  onReload,
  showToast,
}: {
  adminToken: string;
  categories: Category[];
  onReload: () => Promise<void>;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [name, setName] = useState('');
  const [parentGroup, setParentGroup] = useState('mens-clothing');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/categories', {
        method: 'POST',
        adminToken,
        body: JSON.stringify({ name, parentGroup }),
      });
      setName('');
      showToast('Category added.');
      await onReload();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to add category.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold">
        Product Categories ({categories.length})
      </h2>

      <form
        onSubmit={handleAdd}
        className="p-4 bg-white border border-black/10 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-medium mb-1">New Category Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Agbada Couture"
            className="px-3 py-2 border border-black/15 text-xs w-56"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Group</label>
          <select
            value={parentGroup}
            onChange={(e) => setParentGroup(e.target.value)}
            className="px-3 py-2 border border-black/15 text-xs bg-white"
          >
            <option value="mens-clothing">Men's Clothing</option>
            <option value="shoes">Shoes</option>
            <option value="accessories">Men's Accessories</option>
            <option value="collections">Collections</option>
          </select>
        </div>
        <button
          type="submit"
          className="px-5 py-2 bg-[#111111] text-white text-xs font-semibold uppercase"
        >
          Create Category
        </button>
      </form>

      <div className="bg-white border border-black/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase">
            <tr>
              <th className="p-3">Category</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Group</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/8">
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 font-mono text-[#111111]/60">{c.slug}</td>
                <td className="p-3 capitalize">{c.parentGroup.replace(/-/g, ' ')}</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/categories/${c.id}`, {
                        method: 'DELETE',
                        adminToken,
                      });
                      showToast('Category deleted.');
                      await onReload();
                    }}
                    className="text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryPanel({
  adminToken,
  products,
  onReload,
  showToast,
}: {
  adminToken: string;
  products: Product[];
  onReload: () => Promise<void>;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [draftStock, setDraftStock] = useState<Record<number, string>>({});

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-semibold">
        Inventory & Restocking
      </h2>
      <div className="bg-white border border-black/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase">
            <tr>
              <th className="p-3.5">Product</th>
              <th className="p-3.5">SKU</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Current Stock</th>
              <th className="p-3.5 text-right">Update Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/8">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="p-3.5 font-medium">{p.name}</td>
                <td className="p-3.5 font-mono">{p.sku}</td>
                <td className="p-3.5">
                  {p.stockQuantity === 0 ? (
                    <span className="text-red-700 font-semibold">Out of Stock</span>
                  ) : p.stockQuantity <= 5 ? (
                    <span className="text-amber-700 font-semibold">Low Stock</span>
                  ) : (
                    <span className="text-emerald-800">Healthy</span>
                  )}
                </td>
                <td className="p-3.5 text-right font-mono">{p.stockQuantity}</td>
                <td className="p-3.5 text-right">
                  <div className="inline-flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={draftStock[p.id] ?? String(p.stockQuantity)}
                      onChange={(e) =>
                        setDraftStock((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="w-20 px-2 py-1 border border-black/20 text-right font-mono"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const qty = Number(draftStock[p.id] ?? p.stockQuantity);
                        await apiFetch(`/api/admin/inventory/${p.id}`, {
                          method: 'PUT',
                          adminToken,
                          body: JSON.stringify({ stockQuantity: qty }),
                        });
                        showToast(`Restocked ${p.name} to ${qty} units.`);
                        await onReload();
                      }}
                      className="px-3 py-1 bg-[#111111] text-white"
                    >
                      Save
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CouponsPanel({
  adminToken,
  coupons,
  onReload,
  showToast,
}: {
  adminToken: string;
  coupons: any[];
  onReload: () => Promise<void>;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [minPurchase, setMinPurchase] = useState('25000');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/coupons', {
        method: 'POST',
        adminToken,
        body: JSON.stringify({
          code,
          discountType,
          discountValue: Number(discountValue),
          minPurchase: Number(minPurchase),
        }),
      });
      setCode('');
      showToast('Coupon created.');
      await onReload();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to add coupon.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold">Coupons & Discounts</h2>

      <form
        onSubmit={handleAdd}
        className="p-4 bg-white border border-black/10 flex flex-wrap gap-3 items-end text-xs"
      >
        <div>
          <label className="block font-medium mb-1">Code</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VIP20"
            className="px-3 py-2 border border-black/15 font-mono uppercase w-36"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
            className="px-3 py-2 border border-black/15 bg-white"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (₦)</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Value</label>
          <input
            type="number"
            required
            min={1}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="px-3 py-2 border border-black/15 font-mono w-28"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Min Purchase (₦)</label>
          <input
            type="number"
            min={0}
            value={minPurchase}
            onChange={(e) => setMinPurchase(e.target.value)}
            className="px-3 py-2 border border-black/15 font-mono w-32"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 bg-[#111111] text-white font-semibold uppercase"
        >
          Add Coupon
        </button>
      </form>

      <div className="bg-white border border-black/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Min Spend</th>
              <th className="p-3">Uses</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/8">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="p-3 font-mono font-semibold">{c.code}</td>
                <td className="p-3 font-mono">
                  {c.discountType === 'percentage'
                    ? `${c.discountValue}%`
                    : formatNaira(c.discountValue)}
                </td>
                <td className="p-3 font-mono">{formatNaira(c.minPurchase)}</td>
                <td className="p-3 font-mono">{c.usedCount}</td>
                <td className="p-3">{c.isActive ? 'Active' : 'Paused'}</td>
                <td className="p-3 text-right space-x-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/coupons/${c.id}`, {
                        method: 'PUT',
                        adminToken,
                        body: JSON.stringify({ isActive: !c.isActive }),
                      });
                      await onReload();
                    }}
                    className="underline"
                  >
                    {c.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/coupons/${c.id}`, {
                        method: 'DELETE',
                        adminToken,
                      });
                      await onReload();
                    }}
                    className="text-red-700 underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BannersPanel({
  adminToken,
  banners,
  onReload,
  showToast,
}: {
  adminToken: string;
  banners: Banner[];
  onReload: () => Promise<void>;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('/src/assets/images/hero_diamond_atelier_1795101494057.jpg');
  const [buttonText, setButtonText] = useState('SHOP NOW');
  const [buttonLink, setButtonLink] = useState('/shop');
  const [placement, setPlacement] = useState<'hero' | 'promo'>('promo');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiFetch<{ url: string }>('/api/admin/upload', {
      method: 'POST',
      adminToken,
      body: fd,
    });
    setImageUrl(res.url);
    showToast('Banner image uploaded.');
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold">Website Banners</h2>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch('/api/admin/banners', {
            method: 'POST',
            adminToken,
            body: JSON.stringify({
              title,
              subtitle,
              imageUrl,
              buttonText,
              buttonLink,
              placement,
              isPublished: true,
            }),
          });
          setTitle('');
          setSubtitle('');
          showToast('Banner published.');
          await onReload();
        }}
        className="p-5 bg-white border border-black/10 space-y-3 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Banner Headline"
            className="px-3 py-2 border border-black/15"
          />
          <input
            type="text"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Button Label"
            className="px-3 py-2 border border-black/15"
          />
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value as 'hero' | 'promo')}
            className="px-3 py-2 border border-black/15 bg-white"
          >
            <option value="hero">Hero Placement</option>
            <option value="promo">Promotional Placement</option>
          </select>
        </div>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Banner subtitle..."
          className="w-full px-3 py-2 border border-black/15"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="flex-1 px-3 py-2 border border-black/15"
          />
          <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-black/20 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
          <button
            type="submit"
            className="px-5 py-2 bg-[#111111] text-white font-semibold uppercase"
          >
            Add Banner
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {banners.map((b) => (
          <div key={b.id} className="bg-white border border-black/10 p-4 space-y-3 text-xs">
            <div className="aspect-[16/9] bg-[#F5F5F5] overflow-hidden">
              <LuxuryImage src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
            </div>
            <div className="font-semibold text-sm">{b.title}</div>
            <div className="text-[#111111]/65">{b.subtitle}</div>
            <div className="flex items-center justify-between pt-2 border-t border-black/8">
              <span className="capitalize">
                {b.placement} · {b.isPublished ? 'Published' : 'Hidden'}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/banners/${b.id}`, {
                      method: 'PUT',
                      adminToken,
                      body: JSON.stringify({ isPublished: !b.isPublished }),
                    });
                    await onReload();
                  }}
                  className="underline"
                >
                  {b.isPublished ? 'Hide' : 'Publish'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/banners/${b.id}`, {
                      method: 'DELETE',
                      adminToken,
                    });
                    await onReload();
                  }}
                  className="text-red-700 underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffPanel({
  adminToken,
  staff,
  auditLogs,
  onReload,
  showToast,
}: {
  adminToken: string;
  staff: AdminUser[];
  auditLogs: any[];
  onReload: () => Promise<void>;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('store_manager');
  const [password, setPassword] = useState('');

  return (
    <div className="space-y-8">
      <h2 className="font-display text-2xl font-semibold">
        Staff & Role-Based Permissions
      </h2>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiFetch('/api/admin/staff', {
              method: 'POST',
              adminToken,
              body: JSON.stringify({ fullName, email, username, role, password }),
            });
            setFullName('');
            setEmail('');
            setUsername('');
            setPassword('');
            showToast('Administrator staff account created.');
            await onReload();
          } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : 'Unable to create staff.', 'error');
          }
        }}
        className="p-5 bg-white border border-black/10 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end text-xs"
      >
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full Name"
          className="px-3 py-2 border border-black/15"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Staff Email"
          className="px-3 py-2 border border-black/15"
        />
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="px-3 py-2 border border-black/15"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 border border-black/15 bg-white"
        >
          <option value="super_admin">Super Administrator</option>
          <option value="store_manager">Store Manager</option>
          <option value="content_manager">Content Manager</option>
        </select>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="px-3 py-2 border border-black/15"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[#111111] text-white font-semibold uppercase"
        >
          Add Staff
        </button>
      </form>

      <div className="bg-white border border-black/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase">
            <tr>
              <th className="p-3">Staff Member</th>
              <th className="p-3">Username</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/8">
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="p-3">
                  <div className="font-medium">{s.fullName}</div>
                  <div className="text-[#111111]/55">{s.email}</div>
                </td>
                <td className="p-3 font-mono">{s.username}</td>
                <td className="p-3 capitalize">{s.role.replace(/_/g, ' ')}</td>
                <td className="p-3">{s.isActive ? 'Active' : 'Disabled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-black/10 p-5 space-y-3">
        <h3 className="font-display text-xl font-semibold">Security Audit Trail</h3>
        <div className="space-y-1.5 text-xs font-mono max-h-60 overflow-y-auto">
          {auditLogs.map((l) => (
            <div key={l.id} className="flex justify-between py-1 border-b border-black/6">
              <span>
                {l.action} · {l.resource} ({l.adminEmail})
              </span>
              <span className="text-[#111111]/55">
                {new Date(l.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StoreSettingsPanel({
  adminToken,
  settings,
  zones,
  emailLogs,
  onReload,
  showToast,
}: {
  adminToken: string;
  settings: StoreSettings;
  zones: ShippingZone[];
  emailLogs: any[];
  onReload: () => Promise<void>;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        adminToken,
        body: JSON.stringify(form),
      });
      showToast('Store settings saved & applied live.');
      await onReload();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="font-display text-2xl font-semibold">
        Store Settings, Delivery Zones & Notifications
      </h2>

      <form
        onSubmit={handleSave}
        className="p-6 bg-white border border-black/10 space-y-4 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Store Name</label>
            <input
              type="text"
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              className="w-full px-3 py-2 border border-black/15 text-sm"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 border border-black/15 text-sm"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Business Email</label>
            <input
              type="email"
              value={form.businessEmail}
              onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
              className="w-full px-3 py-2 border border-black/15 text-sm"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">WhatsApp Number (International)</label>
            <input
              type="text"
              value={form.whatsappNumber}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
              className="w-full px-3 py-2 border border-black/15 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Phone Number</label>
            <input
              type="text"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              className="w-full px-3 py-2 border border-black/15 text-sm"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Business Address</label>
            <input
              type="text"
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
              className="w-full px-3 py-2 border border-black/15 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">About Us Policy</label>
          <textarea
            rows={3}
            value={form.policies?.about || ''}
            onChange={(e) =>
              setForm({
                ...form,
                policies: { ...form.policies, about: e.target.value },
              })
            }
            className="w-full px-3 py-2 border border-black/15 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#111111] text-white font-semibold uppercase tracking-wider"
        >
          {saving ? 'Saving...' : 'Save Store Settings'}
        </button>
      </form>

      {/* Shipping Zones */}
      <div className="bg-white border border-black/10 p-6 space-y-4">
        <h3 className="font-display text-xl font-semibold">
          Delivery Locations & Rates
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase">
              <tr>
                <th className="p-3">State / Region</th>
                <th className="p-3">ETA</th>
                <th className="p-3 text-right">Delivery Fee</th>
                <th className="p-3 text-right">Free Delivery Over</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/8">
              {zones.map((z) => (
                <tr key={z.id}>
                  <td className="p-3 font-medium">{z.stateName}</td>
                  <td className="p-3 text-[#111111]/65">{z.estimatedDays}</td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {formatNaira(z.fee)}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {z.freeDeliveryThreshold
                      ? formatNaira(z.freeDeliveryThreshold)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Notification Logs */}
      <div className="bg-white border border-black/10 p-6 space-y-3">
        <h3 className="font-display text-xl font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#8C6D14]" />
          <span>Automated Email Notification Log</span>
        </h3>
        <div className="space-y-1.5 text-xs max-h-56 overflow-y-auto">
          {emailLogs.length === 0 ? (
            <p className="text-[#111111]/55">No notifications dispatched yet.</p>
          ) : (
            emailLogs.map((em) => (
              <div
                key={em.id}
                className="flex justify-between py-1.5 border-b border-black/6"
              >
                <div>
                  <span className="font-semibold">{em.recipientEmail}</span> — {em.subject}
                </div>
                <span className="font-mono text-[#111111]/55">
                  {new Date(em.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
