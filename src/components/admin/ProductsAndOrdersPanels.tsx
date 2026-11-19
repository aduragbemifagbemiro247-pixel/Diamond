import React, { useEffect, useState } from 'react';
import {
  Check,
  Edit3,
  Eye,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, formatNaira } from '../../lib/api';
import type { Category, Order, Product, StoreSettings } from '../../types';
import { LuxuryImage } from '../LuxuryImage';

export function ProductsPanel({
  adminToken,
  categories,
  canDelete,
  showToast,
}: {
  adminToken: string;
  categories: Category[];
  canDelete: boolean;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sizesStr, setSizesStr] = useState('M, L, XL');
  const [colorsStr, setColorsStr] = useState('Obsidian Black');
  const [stockQuantity, setStockQuantity] = useState('15');
  const [images, setImages] = useState<string[]>([]);
  const [mainImage, setMainImage] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [status, setStatus] = useState<'published' | 'draft' | 'hidden'>('published');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ products: Product[] }>('/api/admin/products', {
        adminToken,
      });
      setProducts(res.products);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to load products.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [adminToken]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setSku(`DMND-${Math.floor(1000 + Math.random() * 9000)}`);
    setDescription('');
    setRegularPrice('');
    setDiscountPrice('');
    setCategoryId(categories[0]?.id ? String(categories[0].id) : '');
    setSizesStr('M, L, XL');
    setColorsStr('Obsidian Black');
    setStockQuantity('20');
    setImages([]);
    setMainImage('');
    setIsFeatured(false);
    setIsBestSeller(false);
    setStatus('published');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setSku(p.sku);
    setDescription(p.description);
    setRegularPrice(String(p.regularPrice));
    setDiscountPrice(p.discountPrice ? String(p.discountPrice) : '');
    setCategoryId(p.categoryId ? String(p.categoryId) : '');
    setSizesStr((p.sizes || []).join(', '));
    setColorsStr((p.colors || []).join(', '));
    setStockQuantity(String(p.stockQuantity));
    setImages(p.images || [p.mainImage]);
    setMainImage(p.mainImage);
    setIsFeatured(p.isFeatured);
    setIsBestSeller(p.isBestSeller);
    setStatus(p.status);
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch<{ url: string }>('/api/admin/upload', {
        method: 'POST',
        adminToken,
        body: fd,
      });
      setImages((prev) => [...prev, res.url]);
      if (!mainImage) setMainImage(res.url);
      showToast('Image uploaded permanently.');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name,
      sku,
      description,
      regularPrice: Number(regularPrice),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      categoryId: categoryId ? Number(categoryId) : null,
      sizes: sizesStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      colors: colorsStr
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      stockQuantity: Number(stockQuantity || 0),
      images: images.length > 0 ? images : mainImage ? [mainImage] : [],
      mainImage: mainImage || images[0] || '',
      isFeatured,
      isBestSeller,
      status,
    };

    try {
      if (editing) {
        await apiFetch(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          adminToken,
          body: JSON.stringify(payload),
        });
        showToast('Product updated on storefront.');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          adminToken,
          body: JSON.stringify(payload),
        });
        showToast('New product created.');
      }
      setModalOpen(false);
      await loadProducts();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        adminToken,
      });
      showToast('Product deleted.');
      await loadProducts();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Products Catalog ({products.length})
          </h2>
          <p className="text-xs text-[#111111]/60">
            Manage attire, footwear, and accessories. Changes publish live immediately.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#111111]/45 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or SKU..."
              className="pl-8 pr-3 py-2 border border-black/15 text-xs bg-white w-52"
            />
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-white border border-black/10 animate-pulse" />
      ) : (
        <div className="bg-white border border-black/10 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F5F5] border-b border-black/10 text-[#111111]/70 uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-right">Price</th>
                <th className="p-3.5 text-right">Stock</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/8">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-[#F5F5F5]/60">
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F5F5F5] shrink-0 overflow-hidden">
                        <LuxuryImage
                          src={p.mainImage}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="font-medium text-[#111111]">{p.name}</div>
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-[#111111]/70">{p.sku}</td>
                  <td className="p-3.5 text-[#111111]/70">{p.categoryName}</td>
                  <td className="p-3.5 text-right font-mono tabular-nums">
                    {formatNaira(p.discountPrice ?? p.regularPrice)}
                  </td>
                  <td className="p-3.5 text-right font-mono tabular-nums">
                    <span
                      className={
                        p.stockQuantity <= 5 ? 'text-red-700 font-semibold' : ''
                      }
                    >
                      {p.stockQuantity}
                    </span>
                  </td>
                  <td className="p-3.5 capitalize">{p.status}</td>
                  <td className="p-3.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 hover:bg-black/5"
                        aria-label="Edit product"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-red-700 hover:bg-red-50"
                          aria-label="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-black/15 w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <h3 className="font-display text-2xl font-semibold">
                {editing ? `Edit ${editing.name}` : 'Add New Product'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-black/15 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Regular Price (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Discount Price (₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Stock Qty *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm bg-white"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Sizes (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={sizesStr}
                    onChange={(e) => setSizesStr(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Colours (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={colorsStr}
                    onChange={(e) => setColorsStr(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-sm"
                  />
                </div>
              </div>

              {/* Product Image Uploads & Main Image Selection */}
              <div className="p-4 bg-[#F5F5F5] border border-black/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Product Photography
                  </span>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-white text-xs cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Or paste image path/URL..."
                    className="flex-1 px-3 py-1.5 bg-white border border-black/15 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newImageUrl.trim()) return;
                      setImages((prev) => [...prev, newImageUrl.trim()]);
                      if (!mainImage) setMainImage(newImageUrl.trim());
                      setNewImageUrl('');
                    }}
                    className="px-3 py-1.5 border border-black/20 bg-white text-xs font-medium"
                  >
                    Add URL
                  </button>
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 pt-1">
                    {images.map((url) => (
                      <div
                        key={url}
                        className={`relative border bg-white p-1 ${
                          mainImage === url ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]' : 'border-black/10'
                        }`}
                      >
                        <div className="aspect-[4/3] overflow-hidden">
                          <LuxuryImage
                            src={url}
                            alt="Product preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setMainImage(url)}
                            className="font-medium hover:underline"
                          >
                            {mainImage === url ? 'Main Image' : 'Set Main'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = images.filter((i) => i !== url);
                              setImages(next);
                              if (mainImage === url) setMainImage(next[0] || '');
                            }}
                            className="text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  <span>Featured Product</span>
                </label>
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={isBestSeller}
                    onChange={(e) => setIsBestSeller(e.target.checked)}
                  />
                  <span>Best Seller</span>
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as 'published' | 'draft' | 'hidden')
                  }
                  className="px-3 py-2 border border-black/15 bg-white"
                >
                  <option value="published">Published (Live)</option>
                  <option value="draft">Draft</option>
                  <option value="hidden">Temporarily Hidden</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-black/20 text-xs font-semibold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrdersPanel({
  adminToken,
  isSuperAdmin,
  settings,
  showToast,
}: {
  adminToken: string;
  isSuperAdmin: boolean;
  settings: StoreSettings | null;
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const currency = settings?.currencySymbol || '₦';

  const loadOrders = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      const res = await apiFetch<{ orders: Order[] }>(
        `/api/admin/orders?${qs.toString()}`,
        { adminToken }
      );
      setOrders(res.orders);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to load orders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [adminToken, statusFilter]);

  const openOrder = (ord: Order) => {
    setSelectedOrder(ord);
    setNextStatus(ord.orderStatus);
    setTrackingNumber(ord.trackingNumber || '');
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    try {
      await apiFetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        adminToken,
        body: JSON.stringify({ orderStatus: nextStatus, trackingNumber }),
      });
      showToast('Order updated & client email notification sent.');
      setSelectedOrder(null);
      await loadOrders();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  const handleConfirmManualPayment = async (orderId: number) => {
    try {
      await apiFetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        adminToken,
      });
      showToast('Manual payment confirmed & receipt emailed to customer.');
      setSelectedOrder(null);
      await loadOrders();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Confirmation failed.', 'error');
    }
  };

  const handleRefund = async (orderId: number) => {
    try {
      await apiFetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        adminToken,
      });
      showToast('Order marked as refunded.');
      setSelectedOrder(null);
      await loadOrders();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Refund failed.', 'error');
    }
  };

  const statuses = [
    'Pending Payment',
    'Paid',
    'Processing',
    'Ready for Dispatch',
    'Shipped',
    'Delivered',
    'Cancelled',
    'Refunded',
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Orders & Fulfillment ({orders.length})
          </h2>
          <p className="text-xs text-[#111111]/60">
            Verify transfers, update courier tracking, print PDF invoices, and notify customers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
            placeholder="Order # or customer..."
            className="px-3 py-2 border border-black/15 text-xs bg-white w-48"
          />
          <button
            type="button"
            onClick={loadOrders}
            className="px-3 py-2 bg-[#111111] text-white text-xs font-medium"
          >
            Search
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-black/15 text-xs bg-white"
          >
            <option value="all">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-white border border-black/10 animate-pulse" />
      ) : (
        <div className="bg-white border border-black/10 overflow-x-auto no-print">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F5F5] border-b border-black/10 uppercase tracking-wider text-[#111111]/70">
              <tr>
                <th className="p-3.5">Order #</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Total</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/8">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-[#F5F5F5]/60">
                  <td className="p-3.5 font-mono font-semibold">{ord.orderNumber}</td>
                  <td className="p-3.5">
                    <div className="font-medium">{ord.customerName}</div>
                    <div className="text-[#111111]/55">{ord.customerEmail}</div>
                  </td>
                  <td className="p-3.5 capitalize">
                    {ord.paymentProvider.replace(/_/g, ' ')} ·{' '}
                    <span
                      className={
                        ord.paymentStatus === 'paid'
                          ? 'text-emerald-700 font-semibold'
                          : 'text-amber-700'
                      }
                    >
                      {ord.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3.5 font-medium">{ord.orderStatus}</td>
                  <td className="p-3.5 text-right font-mono tabular-nums font-semibold">
                    {formatNaira(ord.totalAmount, currency)}
                  </td>
                  <td className="p-3.5 font-mono text-[#111111]/60">
                    {new Date(ord.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openOrder(ord)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-black/20 hover:bg-[#111111] hover:text-white transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Detail + Printable Invoice Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-black/15 w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <div>
                <h3 className="font-display text-2xl font-semibold">
                  Invoice · {selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-[#111111]/60">
                  {settings?.storeName || 'DIAMOND STORE'} ·{' '}
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-black/20 text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button type="button" onClick={() => setSelectedOrder(null)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F5F5F5] p-4 border border-black/8">
              <div className="space-y-1">
                <div className="font-semibold uppercase tracking-wider text-[#111111]/60">
                  Customer
                </div>
                <div className="font-semibold">{selectedOrder.customerName}</div>
                <div>{selectedOrder.customerEmail}</div>
                <div>{selectedOrder.customerPhone}</div>
              </div>
              <div className="space-y-1">
                <div className="font-semibold uppercase tracking-wider text-[#111111]/60">
                  Delivery Address
                </div>
                <div>{selectedOrder.shippingAddress.street}</div>
                <div>
                  {selectedOrder.shippingAddress.city}, {selectedOrder.shippingState}
                </div>
                <div>{selectedOrder.shippingAddress.country}</div>
              </div>
            </div>

            <div className="border border-black/10">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F5F5F5] border-b border-black/10">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Variant</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/8">
                  {(selectedOrder.items || []).map((it) => (
                    <tr key={it.id}>
                      <td className="p-3 font-medium">{it.productName}</td>
                      <td className="p-3 text-[#111111]/65">
                        {[it.size, it.color].filter(Boolean).join(' / ') || it.sku}
                      </td>
                      <td className="p-3 text-right font-mono">{it.quantity}</td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        {formatNaira(it.totalPrice, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end text-xs">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatNaira(selectedOrder.subtotal, currency)}
                  </span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-800">
                    <span>Discount</span>
                    <span className="font-mono tabular-nums">
                      -{formatNaira(selectedOrder.discountAmount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span className="font-mono tabular-nums">
                    {formatNaira(selectedOrder.shippingFee, currency)}
                  </span>
                </div>
                {selectedOrder.codFee > 0 && (
                  <div className="flex justify-between">
                    <span>COD Fee</span>
                    <span className="font-mono tabular-nums">
                      {formatNaira(selectedOrder.codFee, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-sm pt-1.5 border-t border-black/15">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">
                    {formatNaira(selectedOrder.totalAmount, currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-black/10 space-y-3 no-print">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Order Status</label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-black/15 text-xs bg-white"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Courier Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. DHL-8829104"
                    className="w-full px-3 py-2 border border-black/15 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleUpdateOrder}
                  className="px-5 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
                >
                  Update Order & Notify Customer
                </button>
                {selectedOrder.paymentStatus !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => handleConfirmManualPayment(selectedOrder.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white text-xs font-semibold uppercase"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Payment Received</span>
                  </button>
                )}
                {isSuperAdmin && selectedOrder.paymentStatus === 'paid' && (
                  <button
                    type="button"
                    onClick={() => handleRefund(selectedOrder.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-700 text-xs font-semibold uppercase"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refund</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
