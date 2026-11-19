import bcrypt from 'bcryptjs';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Router } from 'express';
import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  adminSessions,
  adminUsers,
  auditLogs,
  banners,
  categories,
  coupons,
  emailLogs,
  orderItems,
  orders,
  paymentGateways,
  products,
  reviews,
  shippingZones,
  storeSettings,
  transactions,
  users,
} from '../../db/schema.ts';
import {
  decryptSecret,
  encryptSecret,
  generateRandomToken,
  hashToken,
  maskSecret,
} from '../crypto.ts';
import {
  AppRequest,
  requireAdminAuth,
  requireAdminRole,
} from '../middleware/auth.ts';
import { recordAuditLog, recordEmailNotification } from '../notifications.ts';
import {
  getPaymentAdapter,
  listAvailableProviders,
} from '../payments/registry.ts';
import { ensureSeedData } from '../seed.ts';

export const adminRouter = Router();

// Ensure uploads directory exists safely for persistent image uploads
const uploadDir = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext)
      ? ext
      : '.jpg';
    cb(null, `dmnd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

adminRouter.use(async (_req, _res, next) => {
  try {
    await ensureSeedData();
  } catch (err) {
    console.error('Admin lazy seed check error:', err);
  }
  next();
});

// ========================
// ADMIN AUTHENTICATION
// ========================
adminRouter.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body as {
      identifier?: string;
      password?: string;
    };
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId || !password) {
      return res.status(400).json({ error: 'Email/username and password are required.' });
    }

    const rows = await db
      .select()
      .from(adminUsers)
      .where(or(eq(adminUsers.email, cleanId), eq(adminUsers.username, cleanId)))
      .limit(1);

    const admin = rows[0];
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 3 days

    await db.insert(adminSessions).values({
      adminId: admin.id,
      tokenHash,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || '',
      expiresAt,
    });

    await db
      .update(adminUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminUsers.id, admin.id));

    await recordAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_LOGIN',
      resource: 'admin_sessions',
      ipAddress: req.ip || '',
    });

    res.json({
      token: rawToken,
      admin: {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Administrator authentication failed.' });
  }
});

adminRouter.post('/forgot-password', async (req, res) => {
  try {
    const cleanEmail = (req.body?.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Administrator email is required.' });
    }
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, cleanEmail))
      .limit(1);
    if (rows[0]) {
      const token = generateRandomToken(20);
      await db
        .update(adminUsers)
        .set({
          resetToken: token,
          resetExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
        })
        .where(eq(adminUsers.id, rows[0].id));

      await recordEmailNotification({
        recipientEmail: cleanEmail,
        subject: 'DIAMOND STORE Admin — Password Reset Request',
        eventType: 'admin_password_reset',
        payload: { resetToken: token },
      });
    }
    res.json({
      message: 'If this email belongs to an administrator, reset instructions have been sent.',
    });
  } catch (error) {
    console.error('Admin forgot password error:', error);
    res.status(500).json({ error: 'Unable to initiate password reset.' });
  }
});

adminRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body as {
      token?: string;
      newPassword?: string;
    };
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: 'Valid reset token and strong password (8+ characters) required.',
      });
    }
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.resetToken, token))
      .limit(1);
    const admin = rows[0];
    if (!admin || !admin.resetExpiresAt || new Date(admin.resetExpiresAt) < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(adminUsers)
      .set({
        passwordHash,
        resetToken: null,
        resetExpiresAt: null,
      })
      .where(eq(adminUsers.id, admin.id));
    res.json({ message: 'Administrator password updated.' });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

// Protected admin routes below
adminRouter.use(requireAdminAuth);

adminRouter.post('/logout', async (req: AppRequest, res) => {
  try {
    if (req.admin?.sessionId) {
      await db
        .delete(adminSessions)
        .where(eq(adminSessions.id, req.admin.sessionId));
    }
    res.json({ loggedOut: true });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({ error: 'Unable to log out.' });
  }
});

adminRouter.get('/me', async (req: AppRequest, res) => {
  try {
    const sessions = await db
      .select({
        id: adminSessions.id,
        userAgent: adminSessions.userAgent,
        ipAddress: adminSessions.ipAddress,
        createdAt: adminSessions.createdAt,
        expiresAt: adminSessions.expiresAt,
      })
      .from(adminSessions)
      .where(eq(adminSessions.adminId, req.admin!.id))
      .orderBy(desc(adminSessions.createdAt));

    res.json({
      admin: req.admin,
      sessions,
    });
  } catch (error) {
    console.error('Admin me error:', error);
    res.status(500).json({ error: 'Unable to fetch session details.' });
  }
});

adminRouter.delete('/sessions/:id', async (req: AppRequest, res) => {
  try {
    const sessionId = Number(req.params.id);
    await db
      .delete(adminSessions)
      .where(
        and(
          eq(adminSessions.id, sessionId),
          eq(adminSessions.adminId, req.admin!.id)
        )
      );
    res.json({ revoked: true });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Unable to revoke session.' });
  }
});

// ========================
// OVERVIEW & ANALYTICS
// ========================
adminRouter.get('/overview', async (_req, res) => {
  try {
    const [
      allOrders,
      allProducts,
      customerCountRows,
      recentOrders,
      recentTxns,
    ] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(products),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(users),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6),
      db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(6),
    ]);

    const paidOrders = allOrders.filter(
      (o) => o.paymentStatus === 'paid' || o.orderStatus === 'Delivered'
    );
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const pendingOrders = allOrders.filter(
      (o) =>
        o.orderStatus === 'Pending Payment' ||
        o.orderStatus === 'Processing' ||
        o.orderStatus === 'Ready for Dispatch'
    ).length;
    const completedOrders = allOrders.filter(
      (o) => o.orderStatus === 'Delivered'
    ).length;

    const lowStockProducts = allProducts.filter((p) => p.stockQuantity <= 5);
    const availableProducts = allProducts.filter((p) => p.status === 'published').length;

    // Daily revenue over the last 7 days
    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of paidOrders) {
      const dayKey = new Date(o.createdAt).toISOString().slice(0, 10);
      if (dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + o.totalAmount);
      }
    }
    const salesChart = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    // Gateway performance
    const gwBreakdownMap = new Map<string, { count: number; total: number }>();
    for (const o of allOrders) {
      const prev = gwBreakdownMap.get(o.paymentProvider) || { count: 0, total: 0 };
      gwBreakdownMap.set(o.paymentProvider, {
        count: prev.count + 1,
        total: prev.total + o.totalAmount,
      });
    }
    const gatewayPerformance = Array.from(gwBreakdownMap.entries()).map(
      ([provider, stats]) => ({
        provider,
        ...stats,
      })
    );

    res.json({
      kpis: {
        totalRevenue,
        totalOrders: allOrders.length,
        pendingOrders,
        completedOrders,
        totalCustomers: customerCountRows[0]?.count ?? 0,
        availableProducts,
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
      recentOrders,
      recentTransactions: recentTxns,
      salesChart,
      gatewayPerformance,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Unable to load dashboard metrics.' });
  }
});

// ========================
// IMAGE UPLOAD
// ========================
adminRouter.post(
  '/upload',
  requireAdminRole('super_admin', 'store_manager', 'content_manager'),
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, filename: req.file.filename });
  }
);

// ========================
// PRODUCTS CRUD
// ========================
adminRouter.get('/products', async (_req, res) => {
  try {
    const rows = await db
      .select({
        product: products,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.createdAt));

    res.json({
      products: rows.map((r) => ({
        ...r.product,
        categoryName: r.categoryName || 'Uncategorized',
      })),
    });
  } catch (error) {
    console.error('Admin products error:', error);
    res.status(500).json({ error: 'Unable to fetch products.' });
  }
});

adminRouter.post(
  '/products',
  requireAdminRole('super_admin', 'store_manager', 'content_manager'),
  async (req: AppRequest, res) => {
    try {
      const b = req.body;
      if (!b.name?.trim() || !b.sku?.trim() || !b.regularPrice) {
        return res.status(400).json({ error: 'Name, SKU, and Regular Price are required.' });
      }
      const baseSlug = (b.slug || b.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const inserted = await db
        .insert(products)
        .values({
          name: b.name.trim(),
          slug,
          sku: b.sku.trim().toUpperCase(),
          description: (b.description || '').trim(),
          regularPrice: Math.round(Number(b.regularPrice)),
          discountPrice: b.discountPrice ? Math.round(Number(b.discountPrice)) : null,
          categoryId: b.categoryId ? Number(b.categoryId) : null,
          collectionTags: Array.isArray(b.collectionTags) ? b.collectionTags : [],
          images: Array.isArray(b.images) && b.images.length > 0 ? b.images : [b.mainImage || '/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg'],
          mainImage: b.mainImage || b.images?.[0] || '/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg',
          sizes: Array.isArray(b.sizes) ? b.sizes : [],
          colors: Array.isArray(b.colors) ? b.colors : [],
          stockQuantity: Math.max(0, Math.round(Number(b.stockQuantity || 0))),
          variantStock: b.variantStock || {},
          isFeatured: Boolean(b.isFeatured),
          isBestSeller: Boolean(b.isBestSeller),
          status: b.status || 'published',
          metaTitle: (b.metaTitle || b.name).trim(),
          metaDescription: (b.metaDescription || b.description || '').slice(0, 160),
        })
        .returning();

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'CREATE_PRODUCT',
        resource: `products:${inserted[0].id}`,
        details: { name: inserted[0].name, sku: inserted[0].sku },
      });

      res.status(201).json({ product: inserted[0] });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: 'Unable to create product. Ensure SKU is unique.' });
    }
  }
);

adminRouter.put(
  '/products/:id',
  requireAdminRole('super_admin', 'store_manager', 'content_manager'),
  async (req: AppRequest, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body;
      const updated = await db
        .update(products)
        .set({
          name: b.name?.trim(),
          sku: b.sku?.trim().toUpperCase(),
          description: b.description?.trim(),
          regularPrice:
            b.regularPrice !== undefined ? Math.round(Number(b.regularPrice)) : undefined,
          discountPrice:
            b.discountPrice === null || b.discountPrice === ''
              ? null
              : b.discountPrice !== undefined
                ? Math.round(Number(b.discountPrice))
                : undefined,
          categoryId:
            b.categoryId === null || b.categoryId === ''
              ? null
              : b.categoryId !== undefined
                ? Number(b.categoryId)
                : undefined,
          collectionTags: Array.isArray(b.collectionTags) ? b.collectionTags : undefined,
          images: Array.isArray(b.images) ? b.images : undefined,
          mainImage: b.mainImage,
          sizes: Array.isArray(b.sizes) ? b.sizes : undefined,
          colors: Array.isArray(b.colors) ? b.colors : undefined,
          stockQuantity:
            b.stockQuantity !== undefined
              ? Math.max(0, Math.round(Number(b.stockQuantity)))
              : undefined,
          variantStock: b.variantStock,
          isFeatured: b.isFeatured !== undefined ? Boolean(b.isFeatured) : undefined,
          isBestSeller:
            b.isBestSeller !== undefined ? Boolean(b.isBestSeller) : undefined,
          status: b.status,
          metaTitle: b.metaTitle,
          metaDescription: b.metaDescription,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      if (!updated[0]) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'UPDATE_PRODUCT',
        resource: `products:${id}`,
        details: { name: updated[0].name },
      });

      res.json({ product: updated[0] });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ error: 'Unable to update product.' });
    }
  }
);

adminRouter.delete(
  '/products/:id',
  requireAdminRole('super_admin', 'store_manager'),
  async (req: AppRequest, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(products).where(eq(products.id, id));
      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'DELETE_PRODUCT',
        resource: `products:${id}`,
      });
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({ error: 'Unable to delete product.' });
    }
  }
);

// ========================
// CATEGORIES CRUD
// ========================
adminRouter.get('/categories', async (_req, res) => {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(categories.displayOrder, categories.name);
  res.json({ categories: rows });
});

adminRouter.post(
  '/categories',
  requireAdminRole('super_admin', 'store_manager', 'content_manager'),
  async (req, res) => {
    try {
      const { name, parentGroup, description, imageUrl } = req.body as {
        name?: string;
        parentGroup?: string;
        description?: string;
        imageUrl?: string;
      };
      if (!name?.trim()) return res.status(400).json({ error: 'Category name required.' });
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const inserted = await db
        .insert(categories)
        .values({
          name: name.trim(),
          slug,
          parentGroup: parentGroup || 'mens-clothing',
          description: (description || '').trim(),
          imageUrl: imageUrl || '',
        })
        .returning();
      res.status(201).json({ category: inserted[0] });
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: 'Unable to create category.' });
    }
  }
);

adminRouter.put(
  '/categories/:id',
  requireAdminRole('super_admin', 'store_manager', 'content_manager'),
  async (req, res) => {
    const id = Number(req.params.id);
    const { name, parentGroup, description, imageUrl, isActive } = req.body;
    const updated = await db
      .update(categories)
      .set({
        name: name?.trim(),
        parentGroup,
        description,
        imageUrl,
        isActive,
      })
      .where(eq(categories.id, id))
      .returning();
    res.json({ category: updated[0] });
  }
);

adminRouter.delete(
  '/categories/:id',
  requireAdminRole('super_admin', 'store_manager'),
  async (req, res) => {
    const id = Number(req.params.id);
    await db.delete(categories).where(eq(categories.id, id));
    res.json({ deleted: true });
  }
);

// ========================
// ORDERS & FULFILLMENT
// ========================
adminRouter.get('/orders', async (req, res) => {
  try {
    const q = (req.query.search as string | undefined)?.trim().toLowerCase();
    const status = (req.query.status as string | undefined)?.trim();

    const all = await db.select().from(orders).orderBy(desc(orders.createdAt));
    let filtered = all;
    if (q) {
      filtered = filtered.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q)
      );
    }
    if (status && status !== 'all') {
      filtered = filtered.filter((o) => o.orderStatus === status);
    }

    const withItems = await Promise.all(
      filtered.map(async (ord) => {
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, ord.id));
        return { ...ord, items };
      })
    );

    res.json({ orders: withItems });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'Unable to load orders.' });
  }
});

adminRouter.put(
  '/orders/:id',
  requireAdminRole('super_admin', 'store_manager'),
  async (req: AppRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { orderStatus, trackingNumber, notes } = req.body as {
        orderStatus?: string;
        trackingNumber?: string;
        notes?: string;
      };

      const existingRows = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: 'Order not found.' });

      // If cancelling an un-cancelled order, restore stock
      if (orderStatus === 'Cancelled' && existing.orderStatus !== 'Cancelled') {
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, id));
        for (const it of items) {
          if (it.productId) {
            await db
              .update(products)
              .set({
                stockQuantity: sql`${products.stockQuantity} + ${it.quantity}`,
              })
              .where(eq(products.id, it.productId));
          }
        }
      }

      const updated = await db
        .update(orders)
        .set({
          orderStatus: orderStatus ?? existing.orderStatus,
          trackingNumber: trackingNumber ?? existing.trackingNumber,
          notes: notes ?? existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id))
        .returning();

      if (orderStatus && orderStatus !== existing.orderStatus) {
        await recordEmailNotification({
          recipientEmail: existing.customerEmail,
          subject: `Order ${existing.orderNumber} Update: ${orderStatus}`,
          eventType: 'order_status_changed',
          payload: {
            orderNumber: existing.orderNumber,
            newStatus: orderStatus,
            trackingNumber: trackingNumber ?? existing.trackingNumber,
          },
        });
      }

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'UPDATE_ORDER_STATUS',
        resource: `orders:${id}`,
        details: { orderNumber: existing.orderNumber, orderStatus },
      });

      res.json({ order: updated[0] });
    } catch (error) {
      console.error('Update order error:', error);
      res.status(500).json({ error: 'Unable to update order.' });
    }
  }
);

// Manual Bank Transfer / COD Payment Confirmation
adminRouter.post(
  '/orders/:id/confirm-payment',
  requireAdminRole('super_admin', 'store_manager'),
  async (req: AppRequest, res) => {
    try {
      const id = Number(req.params.id);
      const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      const order = rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({
            paymentStatus: 'paid',
            orderStatus:
              order.orderStatus === 'Pending Payment' ? 'Paid' : order.orderStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, id));

        await tx
          .update(transactions)
          .set({
            status: 'verified',
            verifiedWithProvider: true,
            providerPayload: { confirmedByAdmin: req.admin!.email },
          })
          .where(eq(transactions.orderId, id));
      });

      await recordEmailNotification({
        recipientEmail: order.customerEmail,
        subject: `Payment Confirmed — DIAMOND STORE Order ${order.orderNumber}`,
        eventType: 'payment_confirmed',
        payload: { orderNumber: order.orderNumber, amount: order.totalAmount },
      });

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'CONFIRM_MANUAL_PAYMENT',
        resource: `orders:${id}`,
        details: { orderNumber: order.orderNumber },
      });

      res.json({ confirmed: true });
    } catch (error) {
      console.error('Confirm payment error:', error);
      res.status(500).json({ error: 'Unable to confirm payment.' });
    }
  }
);

adminRouter.post(
  '/orders/:id/refund',
  requireAdminRole('super_admin'),
  async (req: AppRequest, res) => {
    try {
      const id = Number(req.params.id);
      const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      const order = rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({
            paymentStatus: 'refunded',
            orderStatus: 'Refunded',
            updatedAt: new Date(),
          })
          .where(eq(orders.id, id));
        await tx
          .update(transactions)
          .set({ status: 'refunded' })
          .where(eq(transactions.orderId, id));
      });

      await recordEmailNotification({
        recipientEmail: order.customerEmail,
        subject: `Refund Processed — DIAMOND STORE Order ${order.orderNumber}`,
        eventType: 'order_refunded',
        payload: { orderNumber: order.orderNumber, amount: order.totalAmount },
      });

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'REFUND_ORDER',
        resource: `orders:${id}`,
        details: { orderNumber: order.orderNumber },
      });

      res.json({ refunded: true });
    } catch (error) {
      console.error('Refund error:', error);
      res.status(500).json({ error: 'Unable to refund order.' });
    }
  }
);

// ========================
// DYNAMIC PAYMENT GATEWAY MANAGEMENT (SUPER ADMIN)
// ========================
adminRouter.get('/payment-gateways/providers', (_req, res) => {
  res.json({ providers: listAvailableProviders() });
});

adminRouter.get(
  '/payment-gateways',
  requireAdminRole('super_admin', 'store_manager'),
  async (_req, res) => {
    const rows = await db
      .select()
      .from(paymentGateways)
      .orderBy(paymentGateways.id);

    // Mask all secret keys before returning to Admin UI
    const sanitized = rows.map((gw) => {
      const decryptedSecret = decryptSecret(gw.secretKeyEncrypted);
      const decryptedWebhook = decryptSecret(gw.webhookSecretEncrypted);
      return {
        id: gw.id,
        provider: gw.provider,
        displayName: gw.displayName,
        mode: gw.mode,
        publicKey: gw.publicKey,
        hasSecretKey: Boolean(decryptedSecret),
        secretKeyMasked: maskSecret(decryptedSecret),
        hasWebhookSecret: Boolean(decryptedWebhook),
        webhookSecretMasked: maskSecret(decryptedWebhook),
        config: gw.config,
        isActive: gw.isActive,
        isDefault: gw.isDefault,
        lastTestedAt: gw.lastTestedAt,
        lastTestStatus: gw.lastTestStatus,
        updatedAt: gw.updatedAt,
      };
    });

    res.json({ gateways: sanitized });
  }
);

adminRouter.post(
  '/payment-gateways',
  requireAdminRole('super_admin'),
  async (req: AppRequest, res) => {
    try {
      const {
        provider,
        displayName,
        mode,
        publicKey,
        secretKey,
        webhookSecret,
        config,
        isActive,
        isDefault,
      } = req.body;

      const adapter = getPaymentAdapter(provider);
      if (!adapter) {
        return res.status(400).json({ error: 'Unsupported payment provider.' });
      }

      if (isDefault) {
        await db.update(paymentGateways).set({ isDefault: false });
      }

      const inserted = await db
        .insert(paymentGateways)
        .values({
          provider,
          displayName: (displayName || adapter.name).trim(),
          mode: mode === 'live' ? 'live' : 'test',
          publicKey: (publicKey || '').trim(),
          secretKeyEncrypted: encryptSecret((secretKey || '').trim()),
          webhookSecretEncrypted: encryptSecret((webhookSecret || '').trim()),
          config: config || {},
          isActive: Boolean(isActive),
          isDefault: Boolean(isDefault),
        })
        .returning();

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'ADD_PAYMENT_GATEWAY',
        resource: `payment_gateways:${inserted[0].id}`,
        details: { provider, mode },
      });

      res.status(201).json({ gatewayId: inserted[0].id });
    } catch (error) {
      console.error('Add gateway error:', error);
      res.status(500).json({ error: 'Unable to create payment gateway.' });
    }
  }
);

adminRouter.put(
  '/payment-gateways/:id',
  requireAdminRole('super_admin'),
  async (req: AppRequest, res) => {
    try {
      const id = Number(req.params.id);
      const existingRows = await db
        .select()
        .from(paymentGateways)
        .where(eq(paymentGateways.id, id))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: 'Gateway not found.' });

      const {
        displayName,
        mode,
        publicKey,
        secretKey,
        webhookSecret,
        config,
        isActive,
        isDefault,
      } = req.body;

      if (isDefault) {
        await db.update(paymentGateways).set({ isDefault: false });
      }

      await db
        .update(paymentGateways)
        .set({
          displayName: displayName !== undefined ? displayName.trim() : existing.displayName,
          mode: mode !== undefined ? (mode === 'live' ? 'live' : 'test') : existing.mode,
          publicKey: publicKey !== undefined ? publicKey.trim() : existing.publicKey,
          secretKeyEncrypted:
            secretKey && secretKey.trim()
              ? encryptSecret(secretKey.trim())
              : existing.secretKeyEncrypted,
          webhookSecretEncrypted:
            webhookSecret && webhookSecret.trim()
              ? encryptSecret(webhookSecret.trim())
              : existing.webhookSecretEncrypted,
          config: config !== undefined ? config : existing.config,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
          isDefault: isDefault !== undefined ? Boolean(isDefault) : existing.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(paymentGateways.id, id));

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'UPDATE_PAYMENT_GATEWAY',
        resource: `payment_gateways:${id}`,
        details: { provider: existing.provider, isActive },
      });

      res.json({ updated: true });
    } catch (error) {
      console.error('Update gateway error:', error);
      res.status(500).json({ error: 'Unable to update payment gateway.' });
    }
  }
);

adminRouter.post(
  '/payment-gateways/:id/test',
  requireAdminRole('super_admin'),
  async (req: AppRequest, res) => {
    try {
      const id = Number(req.params.id);
      const rows = await db
        .select()
        .from(paymentGateways)
        .where(eq(paymentGateways.id, id))
        .limit(1);
      const gw = rows[0];
      if (!gw) return res.status(404).json({ error: 'Gateway not found.' });

      const adapter = getPaymentAdapter(gw.provider);
      if (!adapter) return res.status(400).json({ error: 'Adapter not found.' });

      const result = await adapter.testConnection({
        publicKey: gw.publicKey,
        secretKey: decryptSecret(gw.secretKeyEncrypted),
        webhookSecret: decryptSecret(gw.webhookSecretEncrypted),
        mode: gw.mode === 'live' ? 'live' : 'test',
        config: gw.config || {},
      });

      await db
        .update(paymentGateways)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: result.ok ? 'connected' : 'error',
        })
        .where(eq(paymentGateways.id, id));

      res.json(result);
    } catch (error) {
      console.error('Test gateway error:', error);
      res.status(500).json({ ok: false, message: 'Connection test failed.' });
    }
  }
);

adminRouter.delete(
  '/payment-gateways/:id',
  requireAdminRole('super_admin'),
  async (req: AppRequest, res) => {
    const id = Number(req.params.id);
    await db.delete(paymentGateways).where(eq(paymentGateways.id, id));
    await recordAuditLog({
      adminId: req.admin!.id,
      adminEmail: req.admin!.email,
      action: 'DELETE_PAYMENT_GATEWAY',
      resource: `payment_gateways:${id}`,
    });
    res.json({ deleted: true });
  }
);

// ========================
// TRANSACTIONS
// ========================
adminRouter.get('/transactions', async (_req, res) => {
  const rows = await db
    .select({
      transaction: transactions,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
    })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .orderBy(desc(transactions.createdAt));

  res.json({
    transactions: rows.map((r) => ({
      ...r.transaction,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      customerEmail: r.customerEmail,
    })),
  });
});

// ========================
// CUSTOMERS (never returns passwordHash)
// ========================
adminRouter.get('/customers', async (_req, res) => {
  const customerRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      defaultAddress: users.defaultAddress,
      isSuspended: users.isSuspended,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const orderTotals = await db
    .select({
      userId: orders.userId,
      orderCount: sql<number>`COUNT(${orders.id})::int`,
      totalSpent: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)::int`,
    })
    .from(orders)
    .groupBy(orders.userId);

  const statsMap = new Map(
    orderTotals
      .filter((o) => o.userId !== null)
      .map((o) => [o.userId!, { orderCount: o.orderCount, totalSpent: o.totalSpent }])
  );

  res.json({
    customers: customerRows.map((c) => ({
      ...c,
      orderCount: statsMap.get(c.id)?.orderCount ?? 0,
      totalSpent: statsMap.get(c.id)?.totalSpent ?? 0,
    })),
  });
});

adminRouter.put(
  '/customers/:id/suspend',
  requireAdminRole('super_admin', 'store_manager'),
  async (req: AppRequest, res) => {
    const id = Number(req.params.id);
    const isSuspended = Boolean(req.body?.isSuspended);
    await db
      .update(users)
      .set({ isSuspended, updatedAt: new Date() })
      .where(eq(users.id, id));
    await recordAuditLog({
      adminId: req.admin!.id,
      adminEmail: req.admin!.email,
      action: isSuspended ? 'SUSPEND_CUSTOMER' : 'UNSUSPEND_CUSTOMER',
      resource: `users:${id}`,
    });
    res.json({ updated: true });
  }
);

// ========================
// INVENTORY
// ========================
adminRouter.put(
  '/inventory/:productId',
  requireAdminRole('super_admin', 'store_manager'),
  async (req: AppRequest, res) => {
    const productId = Number(req.params.productId);
    const { stockQuantity, variantStock } = req.body;
    const updated = await db
      .update(products)
      .set({
        stockQuantity: Math.max(0, Math.round(Number(stockQuantity || 0))),
        variantStock: variantStock || undefined,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();
    res.json({ product: updated[0] });
  }
);

// ========================
// COUPONS
// ========================
adminRouter.get('/coupons', async (_req, res) => {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  res.json({ coupons: rows });
});

adminRouter.post(
  '/coupons',
  requireAdminRole('super_admin', 'store_manager'),
  async (req, res) => {
    try {
      const b = req.body;
      const inserted = await db
        .insert(coupons)
        .values({
          code: String(b.code || '').trim().toUpperCase(),
          discountType: b.discountType === 'fixed' ? 'fixed' : 'percentage',
          discountValue: Math.round(Number(b.discountValue || 0)),
          minPurchase: Math.round(Number(b.minPurchase || 0)),
          maxUses: b.maxUses ? Math.round(Number(b.maxUses)) : null,
          expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
          isActive: b.isActive !== false,
        })
        .returning();
      res.status(201).json({ coupon: inserted[0] });
    } catch (error) {
      console.error('Create coupon error:', error);
      res.status(500).json({ error: 'Unable to create coupon. Code must be unique.' });
    }
  }
);

adminRouter.put(
  '/coupons/:id',
  requireAdminRole('super_admin', 'store_manager'),
  async (req, res) => {
    const id = Number(req.params.id);
    const { isActive } = req.body;
    const updated = await db
      .update(coupons)
      .set({ isActive: Boolean(isActive) })
      .where(eq(coupons.id, id))
      .returning();
    res.json({ coupon: updated[0] });
  }
);

adminRouter.delete(
  '/coupons/:id',
  requireAdminRole('super_admin', 'store_manager'),
  async (req, res) => {
    await db.delete(coupons).where(eq(coupons.id, Number(req.params.id)));
    res.json({ deleted: true });
  }
);

// ========================
// BANNERS
// ========================
adminRouter.get('/banners', async (_req, res) => {
  const rows = await db.select().from(banners).orderBy(banners.displayOrder);
  res.json({ banners: rows });
});

adminRouter.post(
  '/banners',
  requireAdminRole('super_admin', 'content_manager'),
  async (req, res) => {
    const b = req.body;
    const inserted = await db
      .insert(banners)
      .values({
        title: b.title || 'New Season',
        subtitle: b.subtitle || '',
        imageUrl: b.imageUrl || '/src/assets/images/hero_diamond_atelier_1795101494057.jpg',
        buttonText: b.buttonText || 'SHOP NOW',
        buttonLink: b.buttonLink || '/shop',
        placement: b.placement || 'promo',
        isPublished: b.isPublished !== false,
        displayOrder: Number(b.displayOrder || 0),
      })
      .returning();
    res.status(201).json({ banner: inserted[0] });
  }
);

adminRouter.put(
  '/banners/:id',
  requireAdminRole('super_admin', 'content_manager'),
  async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const updated = await db
      .update(banners)
      .set({
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        buttonText: b.buttonText,
        buttonLink: b.buttonLink,
        placement: b.placement,
        isPublished: b.isPublished,
      })
      .where(eq(banners.id, id))
      .returning();
    res.json({ banner: updated[0] });
  }
);

adminRouter.delete(
  '/banners/:id',
  requireAdminRole('super_admin', 'content_manager'),
  async (req, res) => {
    await db.delete(banners).where(eq(banners.id, Number(req.params.id)));
    res.json({ deleted: true });
  }
);

// ========================
// REVIEWS MODERATION
// ========================
adminRouter.get('/reviews', async (_req, res) => {
  const rows = await db
    .select({
      review: reviews,
      productName: products.name,
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .orderBy(desc(reviews.createdAt));
  res.json({
    reviews: rows.map((r) => ({ ...r.review, productName: r.productName || 'Product' })),
  });
});

adminRouter.put(
  '/reviews/:id',
  requireAdminRole('super_admin', 'content_manager', 'store_manager'),
  async (req, res) => {
    const updated = await db
      .update(reviews)
      .set({ isApproved: Boolean(req.body?.isApproved) })
      .where(eq(reviews.id, Number(req.params.id)))
      .returning();
    res.json({ review: updated[0] });
  }
);

adminRouter.delete(
  '/reviews/:id',
  requireAdminRole('super_admin', 'content_manager'),
  async (req, res) => {
    await db.delete(reviews).where(eq(reviews.id, Number(req.params.id)));
    res.json({ deleted: true });
  }
);

// ========================
// SHIPPING ZONES
// ========================
adminRouter.get('/shipping-zones', async (_req, res) => {
  const rows = await db.select().from(shippingZones).orderBy(shippingZones.fee);
  res.json({ shippingZones: rows });
});

adminRouter.post(
  '/shipping-zones',
  requireAdminRole('super_admin', 'store_manager'),
  async (req, res) => {
    const b = req.body;
    const inserted = await db
      .insert(shippingZones)
      .values({
        stateName: b.stateName,
        country: b.country || 'Nigeria',
        fee: Math.round(Number(b.fee || 0)),
        freeDeliveryThreshold: b.freeDeliveryThreshold
          ? Math.round(Number(b.freeDeliveryThreshold))
          : null,
        estimatedDays: b.estimatedDays || '2-4 Business Days',
        codAllowed: Boolean(b.codAllowed),
        isActive: b.isActive !== false,
      })
      .returning();
    res.status(201).json({ shippingZone: inserted[0] });
  }
);

adminRouter.put(
  '/shipping-zones/:id',
  requireAdminRole('super_admin', 'store_manager'),
  async (req, res) => {
    const b = req.body;
    const updated = await db
      .update(shippingZones)
      .set({
        fee: b.fee !== undefined ? Math.round(Number(b.fee)) : undefined,
        freeDeliveryThreshold:
          b.freeDeliveryThreshold === null || b.freeDeliveryThreshold === ''
            ? null
            : b.freeDeliveryThreshold !== undefined
              ? Math.round(Number(b.freeDeliveryThreshold))
              : undefined,
        estimatedDays: b.estimatedDays,
        codAllowed: b.codAllowed,
        isActive: b.isActive,
      })
      .where(eq(shippingZones.id, Number(req.params.id)))
      .returning();
    res.json({ shippingZone: updated[0] });
  }
);

// ========================
// SALES REPORTS
// ========================
adminRouter.get('/reports', async (req, res) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const conditions = [];
    if (from && !Number.isNaN(from.getTime())) {
      conditions.push(gte(orders.createdAt, from));
    }
    if (to && !Number.isNaN(to.getTime())) {
      conditions.push(lte(orders.createdAt, to));
    }

    const orderList =
      conditions.length > 0
        ? await db
            .select()
            .from(orders)
            .where(and(...conditions))
            .orderBy(desc(orders.createdAt))
        : await db.select().from(orders).orderBy(desc(orders.createdAt));

    const paidOrders = orderList.filter(
      (o) => o.paymentStatus === 'paid' || o.orderStatus === 'Delivered'
    );
    const totalRevenue = paidOrders.reduce((s, o) => s + o.totalAmount, 0);

    // Best-selling products
    const itemRows = await db
      .select({
        productName: orderItems.productName,
        sku: orderItems.sku,
        unitsSold: sql<number>`SUM(${orderItems.quantity})::int`,
        revenue: sql<number>`SUM(${orderItems.totalPrice})::int`,
      })
      .from(orderItems)
      .groupBy(orderItems.productName, orderItems.sku)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(10);

    res.json({
      summary: {
        totalOrders: orderList.length,
        paidOrdersCount: paidOrders.length,
        totalRevenue,
        averageOrderValue:
          paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0,
      },
      topProducts: itemRows,
      orders: orderList,
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ error: 'Unable to generate sales report.' });
  }
});

// ========================
// STAFF MANAGEMENT (SUPER ADMIN ONLY)
// ========================
adminRouter.get(
  '/staff',
  requireAdminRole('super_admin'),
  async (_req, res) => {
    const rows = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        username: adminUsers.username,
        fullName: adminUsers.fullName,
        role: adminUsers.role,
        isActive: adminUsers.isActive,
        lastLoginAt: adminUsers.lastLoginAt,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .orderBy(adminUsers.id);
    res.json({ staff: rows });
  }
);

adminRouter.post(
  '/staff',
  requireAdminRole('super_admin'),
  async (req: AppRequest, res) => {
    try {
      const { email, username, fullName, role, password } = req.body as {
        email?: string;
        username?: string;
        fullName?: string;
        role?: string;
        password?: string;
      };
      if (!email?.trim() || !username?.trim() || !fullName?.trim() || !password) {
        return res.status(400).json({ error: 'All staff fields and password are required.' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const inserted = await db
        .insert(adminUsers)
        .values({
          email: email.trim().toLowerCase(),
          username: username.trim().toLowerCase(),
          fullName: fullName.trim(),
          role: ['super_admin', 'store_manager', 'content_manager'].includes(role || '')
            ? role!
            : 'store_manager',
          passwordHash,
          isActive: true,
        })
        .returning({
          id: adminUsers.id,
          email: adminUsers.email,
          username: adminUsers.username,
          fullName: adminUsers.fullName,
          role: adminUsers.role,
          isActive: adminUsers.isActive,
        });

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'CREATE_STAFF',
        resource: `admin_users:${inserted[0].id}`,
        details: { email: inserted[0].email, role: inserted[0].role },
      });

      res.status(201).json({ staff: inserted[0] });
    } catch (error) {
      console.error('Create staff error:', error);
      res.status(500).json({ error: 'Unable to add staff member.' });
    }
  }
);

adminRouter.put(
  '/staff/:id',
  requireAdminRole('super_admin'),
  async (req: AppRequest, res) => {
    const id = Number(req.params.id);
    const { role, isActive } = req.body;
    await db
      .update(adminUsers)
      .set({ role, isActive })
      .where(eq(adminUsers.id, id));
    res.json({ updated: true });
  }
);

// ========================
// STORE SETTINGS & LOGS
// ========================
adminRouter.get('/settings', async (_req, res) => {
  const rows = await db.select().from(storeSettings).limit(1);
  res.json({ settings: rows[0] || null });
});

adminRouter.put(
  '/settings',
  requireAdminRole('super_admin', 'content_manager'),
  async (req: AppRequest, res) => {
    try {
      const b = req.body;
      const rows = await db.select().from(storeSettings).limit(1);
      if (!rows[0]) return res.status(404).json({ error: 'Settings not initialized.' });

      const updated = await db
        .update(storeSettings)
        .set({
          storeName: b.storeName ?? rows[0].storeName,
          tagline: b.tagline ?? rows[0].tagline,
          logoUrl: b.logoUrl ?? rows[0].logoUrl,
          faviconUrl: b.faviconUrl ?? rows[0].faviconUrl,
          businessEmail: b.businessEmail ?? rows[0].businessEmail,
          phoneNumber: b.phoneNumber ?? rows[0].phoneNumber,
          whatsappNumber: b.whatsappNumber ?? rows[0].whatsappNumber,
          businessAddress: b.businessAddress ?? rows[0].businessAddress,
          currencySymbol: b.currencySymbol ?? rows[0].currencySymbol,
          currencyCode: b.currencyCode ?? rows[0].currencyCode,
          socialLinks: b.socialLinks ?? rows[0].socialLinks,
          emailSettings: b.emailSettings ?? rows[0].emailSettings,
          policies: b.policies ?? rows[0].policies,
          updatedAt: new Date(),
        })
        .where(eq(storeSettings.id, rows[0].id))
        .returning();

      await recordAuditLog({
        adminId: req.admin!.id,
        adminEmail: req.admin!.email,
        action: 'UPDATE_STORE_SETTINGS',
        resource: 'store_settings',
      });

      res.json({ settings: updated[0] });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ error: 'Unable to update store settings.' });
    }
  }
);

adminRouter.get('/audit-logs', requireAdminRole('super_admin'), async (_req, res) => {
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  res.json({ logs: rows });
});

adminRouter.get('/email-logs', async (_req, res) => {
  const rows = await db
    .select()
    .from(emailLogs)
    .orderBy(desc(emailLogs.createdAt))
    .limit(40);
  res.json({ logs: rows });
});
