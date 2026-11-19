import { Router } from 'express';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  banners,
  categories,
  contactMessages,
  coupons,
  newsletterSubscribers,
  orderItems,
  orders,
  paymentGateways,
  products,
  reviews,
  shippingZones,
  storeSettings,
  transactions,
} from '../../db/schema.ts';
import { decryptSecret } from '../crypto.ts';
import { AppRequest, optionalCustomerAuth } from '../middleware/auth.ts';
import { recordEmailNotification } from '../notifications.ts';
import { getPaymentAdapter } from '../payments/registry.ts';
import { ensureSeedData } from '../seed.ts';

export const publicRouter = Router();

// Ensure seed data exists lazily on first public read
publicRouter.use(async (_req, _res, next) => {
  try {
    await ensureSeedData();
  } catch (err) {
    console.error('Lazy seed check error:', err);
  }
  next();
});

// Storefront bootstrap data
publicRouter.get('/bootstrap', async (_req, res) => {
  try {
    const [settingsRows, categoryRows, bannerRows, zoneRows, activeGateways] =
      await Promise.all([
        db.select().from(storeSettings).limit(1),
        db
          .select()
          .from(categories)
          .where(eq(categories.isActive, true))
          .orderBy(categories.displayOrder),
        db
          .select()
          .from(banners)
          .where(eq(banners.isPublished, true))
          .orderBy(banners.displayOrder),
        db
          .select()
          .from(shippingZones)
          .where(eq(shippingZones.isActive, true))
          .orderBy(shippingZones.fee),
        db
          .select({
            id: paymentGateways.id,
            provider: paymentGateways.provider,
            displayName: paymentGateways.displayName,
            isDefault: paymentGateways.isDefault,
          })
          .from(paymentGateways)
          .where(eq(paymentGateways.isActive, true)),
      ]);

    res.json({
      settings: settingsRows[0] || null,
      categories: categoryRows,
      banners: bannerRows,
      shippingZones: zoneRows,
      activeGatewaySummary: activeGateways,
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Unable to load store configuration.' });
  }
});

// Browse, search & filter products
publicRouter.get('/products', async (req, res) => {
  try {
    const {
      category,
      group,
      collection,
      search,
      minPrice,
      maxPrice,
      sort,
      featured,
      bestSeller,
    } = req.query as Record<string, string | undefined>;

    const conditions = [eq(products.status, 'published')];

    if (featured === 'true') {
      conditions.push(eq(products.isFeatured, true));
    }
    if (bestSeller === 'true') {
      conditions.push(eq(products.isBestSeller, true));
    }

    if (category) {
      const cat = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, category))
        .limit(1);
      if (cat[0]) {
        conditions.push(eq(products.categoryId, cat[0].id));
      } else {
        return res.json({ products: [] });
      }
    } else if (group) {
      const groupCats = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentGroup, group));
      if (groupCats.length > 0) {
        conditions.push(
          inArray(
            products.categoryId,
            groupCats.map((c) => c.id)
          )
        );
      } else {
        return res.json({ products: [] });
      }
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(products.name, q),
          ilike(products.description, q),
          ilike(products.sku, q)
        )!
      );
    }

    const rows = await db
      .select({
        product: products,
        categoryName: categories.name,
        categorySlug: categories.slug,
        parentGroup: categories.parentGroup,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(desc(products.createdAt));

    // Fetch approved ratings summary
    const ratingRows = await db
      .select({
        productId: reviews.productId,
        avgRating: sql<number>`ROUND(AVG(${reviews.rating})::numeric, 1)`,
        reviewCount: sql<number>`COUNT(${reviews.id})::int`,
      })
      .from(reviews)
      .where(eq(reviews.isApproved, true))
      .groupBy(reviews.productId);

    const ratingMap = new Map(
      ratingRows.map((r) => [
        r.productId,
        { avgRating: Number(r.avgRating || 5), reviewCount: Number(r.reviewCount || 0) },
      ])
    );

    let list = rows.map((r) => {
      const effectivePrice = r.product.discountPrice ?? r.product.regularPrice;
      const ratingInfo = ratingMap.get(r.product.id) || { avgRating: 5, reviewCount: 0 };
      return {
        ...r.product,
        effectivePrice,
        categoryName: r.categoryName || 'Collection',
        categorySlug: r.categorySlug || '',
        parentGroup: r.parentGroup || '',
        avgRating: ratingInfo.avgRating,
        reviewCount: ratingInfo.reviewCount,
      };
    });

    if (collection) {
      const colLower = collection.toLowerCase();
      list = list.filter((p) =>
        (p.collectionTags || []).some((t) => t.toLowerCase() === colLower)
      );
    }

    if (minPrice) {
      const min = Number(minPrice);
      if (!Number.isNaN(min)) list = list.filter((p) => p.effectivePrice >= min);
    }
    if (maxPrice) {
      const max = Number(maxPrice);
      if (!Number.isNaN(max)) list = list.filter((p) => p.effectivePrice <= max);
    }

    if (sort === 'price_asc') {
      list.sort((a, b) => a.effectivePrice - b.effectivePrice);
    } else if (sort === 'price_desc') {
      list.sort((a, b) => b.effectivePrice - a.effectivePrice);
    } else if (sort === 'popular') {
      list.sort(
        (a, b) =>
          Number(b.isBestSeller) - Number(a.isBestSeller) ||
          b.reviewCount - a.reviewCount
      );
    }

    res.json({ products: list });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

// Product Detail + Reviews + Related Products
publicRouter.get('/products/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const rows = await db
      .select({
        product: products,
        categoryName: categories.name,
        categorySlug: categories.slug,
        parentGroup: categories.parentGroup,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.slug, slug), eq(products.status, 'published')))
      .limit(1);

    const item = rows[0];
    if (!item) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const productReviews = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.productId, item.product.id), eq(reviews.isApproved, true))
      )
      .orderBy(desc(reviews.createdAt));

    const avgRating =
      productReviews.length > 0
        ? Number(
            (
              productReviews.reduce((acc, r) => acc + r.rating, 0) /
              productReviews.length
            ).toFixed(1)
          )
        : 5.0;

    const relatedRows = await db
      .select({
        product: products,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.status, 'published'),
          sql`${products.id} != ${item.product.id}`
        )
      )
      .limit(4);

    res.json({
      product: {
        ...item.product,
        effectivePrice: item.product.discountPrice ?? item.product.regularPrice,
        categoryName: item.categoryName || 'Collection',
        categorySlug: item.categorySlug || '',
        parentGroup: item.parentGroup || '',
        avgRating,
        reviewCount: productReviews.length,
      },
      reviews: productReviews,
      relatedProducts: relatedRows.map((r) => ({
        ...r.product,
        effectivePrice: r.product.discountPrice ?? r.product.regularPrice,
        categoryName: r.categoryName || 'Collection',
      })),
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ error: 'Unable to load product details.' });
  }
});

// Submit product review
publicRouter.post('/products/:id/reviews', optionalCustomerAuth, async (req: AppRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const { customerName, rating, comment } = req.body as {
      customerName?: string;
      rating?: number;
      comment?: string;
    };

    const cleanRating = Math.min(5, Math.max(1, Math.round(Number(rating || 5))));
    const name = (req.customer?.fullName || customerName || '').trim();
    const body = (comment || '').trim();

    if (!name || !body) {
      return res.status(400).json({ error: 'Name and review comment are required.' });
    }

    const inserted = await db
      .insert(reviews)
      .values({
        productId,
        userId: req.customer?.id || null,
        customerName: name,
        rating: cleanRating,
        comment: body,
        isApproved: true,
      })
      .returning();

    res.status(201).json({ review: inserted[0] });
  } catch (error) {
    console.error('Review submit error:', error);
    res.status(500).json({ error: 'Unable to submit review.' });
  }
});

// DYNAMIC PAYMENT GATEWAYS FOR CHECKOUT (never exposes secret keys!)
publicRouter.get('/checkout/payment-methods', async (req, res) => {
  try {
    const state = (req.query.state as string | undefined) || '';
    const activeRows = await db
      .select()
      .from(paymentGateways)
      .where(eq(paymentGateways.isActive, true));

    const methods = activeRows
      .filter((gw) => {
        if (gw.provider === 'cash_on_delivery' && state) {
          const eligible = gw.config?.eligibleStates || [];
          if (eligible.length > 0 && !eligible.includes(state)) {
            return false;
          }
        }
        return true;
      })
      .map((gw) => {
        const adapter = getPaymentAdapter(gw.provider);
        return {
          id: gw.id,
          provider: gw.provider,
          displayName: gw.displayName,
          kind: adapter?.kind || 'online',
          description: adapter?.description || '',
          mode: gw.mode,
          publicKey: gw.publicKey,
          isDefault: gw.isDefault,
          bankDetails:
            gw.provider === 'bank_transfer'
              ? {
                  bankName: gw.config?.bankName || '',
                  accountName: gw.config?.accountName || '',
                  accountNumber: gw.config?.accountNumber || '',
                  instructions: gw.config?.instructions || '',
                }
              : undefined,
          codDetails:
            gw.provider === 'cash_on_delivery'
              ? {
                  eligibleStates: gw.config?.eligibleStates || [],
                  additionalFee: Number(gw.config?.additionalFee || 0),
                }
              : undefined,
        };
      });

    res.json({ paymentMethods: methods });
  } catch (error) {
    console.error('Dynamic payment methods error:', error);
    res.status(500).json({ error: 'Unable to load payment methods.' });
  }
});

// Validate coupon code
publicRouter.post('/checkout/validate-coupon', async (req, res) => {
  try {
    const { code, subtotal } = req.body as { code?: string; subtotal?: number };
    const cleanCode = (code || '').trim().toUpperCase();
    const sub = Number(subtotal || 0);

    if (!cleanCode) {
      return res.status(400).json({ error: 'Please enter a coupon code.' });
    }

    const rows = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, cleanCode), eq(coupons.isActive, true)))
      .limit(1);

    const coupon = rows[0];
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon code is invalid or inactive.' });
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'This coupon has expired.' });
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'This coupon has reached its usage limit.' });
    }
    if (sub < coupon.minPurchase) {
      return res.status(400).json({
        error: `Minimum purchase of ₦${coupon.minPurchase.toLocaleString()} required for this coupon.`,
      });
    }

    const discountAmount =
      coupon.discountType === 'percentage'
        ? Math.round((sub * coupon.discountValue) / 100)
        : Math.min(sub, coupon.discountValue);

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
    });
  } catch (error) {
    console.error('Coupon validate error:', error);
    res.status(500).json({ error: 'Unable to validate coupon.' });
  }
});

// Create Order + Server-Side Price/Stock Verification + Dynamic Payment Initialization
publicRouter.post('/checkout/orders', optionalCustomerAuth, async (req: AppRequest, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      shippingState,
      paymentGatewayId,
      couponCode,
      items,
      notes,
    } = req.body as {
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      shippingAddress?: {
        street: string;
        city: string;
        state: string;
        country: string;
        postalCode?: string;
      };
      shippingState?: string;
      paymentGatewayId?: number;
      couponCode?: string;
      items?: Array<{
        productId: number;
        size?: string;
        color?: string;
        quantity: number;
      }>;
      notes?: string;
    };

    if (!customerName?.trim() || !customerEmail?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: 'Customer contact details are required.' });
    }
    if (!shippingAddress?.street?.trim() || !shippingAddress?.city?.trim() || !shippingState?.trim()) {
      return res.status(400).json({ error: 'Complete delivery address and state are required.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your shopping bag is empty.' });
    }
    if (!paymentGatewayId) {
      return res.status(400).json({ error: 'Please select an active payment method.' });
    }

    // Verify selected gateway is active
    const gwRows = await db
      .select()
      .from(paymentGateways)
      .where(and(eq(paymentGateways.id, Number(paymentGatewayId)), eq(paymentGateways.isActive, true)))
      .limit(1);
    const gateway = gwRows[0];
    if (!gateway) {
      return res.status(400).json({ error: 'Selected payment gateway is not currently active.' });
    }

    const adapter = getPaymentAdapter(gateway.provider);
    if (!adapter) {
      return res.status(400).json({ error: 'Unsupported payment gateway adapter.' });
    }

    // Verify shipping zone
    const zoneRows = await db
      .select()
      .from(shippingZones)
      .where(and(eq(shippingZones.stateName, shippingState), eq(shippingZones.isActive, true)))
      .limit(1);
    const zone = zoneRows[0];
    if (!zone) {
      return res.status(400).json({ error: 'Selected delivery location is unavailable.' });
    }

    if (gateway.provider === 'cash_on_delivery') {
      const eligible = gateway.config?.eligibleStates || [];
      if (!zone.codAllowed || (eligible.length > 0 && !eligible.includes(shippingState))) {
        return res.status(400).json({
          error: `Cash on Delivery is not available in ${shippingState}.`,
        });
      }
    }

    // Verify products, prices, and stock server-side
    const productIds = Array.from(new Set(items.map((i) => Number(i.productId))));
    const dbProducts = await db
      .select()
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.status, 'published')));
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let subtotal = 0;
    const preparedItems: Array<{
      productId: number;
      productName: string;
      sku: string;
      imageUrl: string;
      size: string;
      color: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    for (const item of items) {
      const qty = Math.max(1, Math.round(Number(item.quantity || 0)));
      const p = productMap.get(Number(item.productId));
      if (!p) {
        return res.status(400).json({ error: 'One or more products are no longer available.' });
      }
      if (p.stockQuantity < qty) {
        return res.status(400).json({
          error: `Insufficient stock for ${p.name}. Only ${p.stockQuantity} left.`,
        });
      }
      // Check variant stock if tracked
      const variantKey = `${item.size || ''} / ${item.color || ''}`.trim();
      if (
        p.variantStock &&
        variantKey !== '/' &&
        typeof p.variantStock[variantKey] === 'number' &&
        p.variantStock[variantKey] < qty
      ) {
        return res.status(400).json({
          error: `Only ${p.variantStock[variantKey]} units left for ${p.name} (${variantKey}).`,
        });
      }

      const unitPrice = p.discountPrice ?? p.regularPrice;
      const totalPrice = unitPrice * qty;
      subtotal += totalPrice;
      preparedItems.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        imageUrl: p.mainImage,
        size: item.size || '',
        color: item.color || '',
        quantity: qty,
        unitPrice,
        totalPrice,
      });
    }

    // Apply coupon if provided
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode?.trim()) {
      const cleanCode = couponCode.trim().toUpperCase();
      const cRows = await db
        .select()
        .from(coupons)
        .where(and(eq(coupons.code, cleanCode), eq(coupons.isActive, true)))
        .limit(1);
      const coupon = cRows[0];
      if (
        coupon &&
        (!coupon.expiresAt || new Date(coupon.expiresAt) >= new Date()) &&
        (coupon.maxUses === null || coupon.usedCount < coupon.maxUses) &&
        subtotal >= coupon.minPurchase
      ) {
        discountAmount =
          coupon.discountType === 'percentage'
            ? Math.round((subtotal * coupon.discountValue) / 100)
            : Math.min(subtotal, coupon.discountValue);
        appliedCouponCode = coupon.code;
        await db
          .update(coupons)
          .set({ usedCount: coupon.usedCount + 1 })
          .where(eq(coupons.id, coupon.id));
      }
    }

    const freeThreshold = zone.freeDeliveryThreshold;
    const shippingFee =
      freeThreshold !== null && subtotal - discountAmount >= freeThreshold ? 0 : zone.fee;
    const codFee =
      gateway.provider === 'cash_on_delivery'
        ? Number(gateway.config?.additionalFee || 0)
        : 0;
    const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee + codFee);

    const orderNumber = `DMND-${new Date().getFullYear()}-${Math.floor(
      100000 + Math.random() * 900000
    )}`;
    const paymentReference = `TXN-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    // Persist order, orderItems, transaction, and decrement inventory atomically
    const createdOrder = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: req.customer?.id || null,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim().toLowerCase(),
          customerPhone: customerPhone.trim(),
          shippingAddress,
          shippingState,
          subtotal,
          discountAmount,
          couponCode: appliedCouponCode,
          shippingFee,
          codFee,
          totalAmount,
          paymentProvider: gateway.provider,
          paymentReference,
          paymentStatus: 'pending',
          orderStatus:
            gateway.provider === 'cash_on_delivery' ? 'Processing' : 'Pending Payment',
          notes: (notes || '').trim(),
        })
        .returning();

      const order = inserted[0];

      await tx.insert(orderItems).values(
        preparedItems.map((it) => ({
          orderId: order.id,
          ...it,
        }))
      );

      await tx.insert(transactions).values({
        orderId: order.id,
        provider: gateway.provider,
        reference: paymentReference,
        amount: totalAmount,
        currency: 'NGN',
        status: 'initiated',
        verifiedWithProvider: false,
      });

      // Decrement product & variant stock
      for (const it of preparedItems) {
        const current = productMap.get(it.productId)!;
        const nextStock = Math.max(0, current.stockQuantity - it.quantity);
        const nextVariantStock = { ...(current.variantStock || {}) };
        const variantKey = `${it.size} / ${it.color}`.trim();
        if (variantKey !== '/' && typeof nextVariantStock[variantKey] === 'number') {
          nextVariantStock[variantKey] = Math.max(
            0,
            nextVariantStock[variantKey] - it.quantity
          );
        }
        await tx
          .update(products)
          .set({
            stockQuantity: nextStock,
            variantStock: nextVariantStock,
            updatedAt: new Date(),
          })
          .where(eq(products.id, it.productId));
      }

      return order;
    });

    // Initialize payment via modular adapter
    const origin =
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const callbackUrl = `${origin}/checkout/verify?reference=${encodeURIComponent(
      paymentReference
    )}&order=${encodeURIComponent(orderNumber)}`;

    const creds = {
      publicKey: gateway.publicKey,
      secretKey: decryptSecret(gateway.secretKeyEncrypted),
      webhookSecret: decryptSecret(gateway.webhookSecretEncrypted),
      mode: (gateway.mode === 'live' ? 'live' : 'test') as 'live' | 'test',
      config: gateway.config || {},
    };

    const paymentInit = await adapter.initializePayment({
      orderNumber,
      reference: paymentReference,
      amountNgn: totalAmount,
      customerEmail: customerEmail.trim().toLowerCase(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      callbackUrl,
      credentials: creds,
    });

    // If Stripe returned a session ID, store it for verification
    if (
      paymentInit.providerReference &&
      paymentInit.providerReference !== paymentReference
    ) {
      await db
        .update(transactions)
        .set({
          providerPayload: { providerReference: paymentInit.providerReference },
        })
        .where(eq(transactions.reference, paymentReference));
    }

    await recordEmailNotification({
      recipientEmail: createdOrder.customerEmail,
      subject: `DIAMOND STORE — Order ${createdOrder.orderNumber} Received`,
      eventType: 'order_created',
      payload: {
        orderNumber: createdOrder.orderNumber,
        totalAmount: createdOrder.totalAmount,
        paymentProvider: createdOrder.paymentProvider,
      },
    });

    res.status(201).json({
      order: createdOrder,
      items: preparedItems,
      payment: {
        provider: gateway.provider,
        displayName: gateway.displayName,
        reference: paymentReference,
        requiresRedirect: paymentInit.requiresRedirect,
        authorizationUrl: paymentInit.authorizationUrl,
        instructions: paymentInit.instructions,
        bankDetails:
          gateway.provider === 'bank_transfer' ? gateway.config : undefined,
      },
    });
  } catch (error) {
    console.error('Order checkout error:', error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Unable to complete checkout.',
    });
  }
});

// Server-side payment verification (never trusts redirect alone!)
publicRouter.get('/payments/verify/:reference', async (req, res) => {
  try {
    const reference = req.params.reference;
    const sessionId = req.query.session_id as string | undefined;

    const txnRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.reference, reference))
      .limit(1);
    const txn = txnRows[0];
    if (!txn) {
      return res.status(404).json({ error: 'Transaction reference not found.' });
    }

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, txn.orderId))
      .limit(1);
    const order = orderRows[0];
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Duplicate verification guard: if already verified & paid, return cleanly
    if (txn.verifiedWithProvider && order.paymentStatus === 'paid') {
      return res.json({
        verified: true,
        order,
        message: 'Payment already verified.',
      });
    }

    const gwRows = await db
      .select()
      .from(paymentGateways)
      .where(eq(paymentGateways.provider, txn.provider))
      .limit(1);
    const gateway = gwRows[0];
    const adapter = getPaymentAdapter(txn.provider);

    if (!gateway || !adapter) {
      return res.status(400).json({ error: 'Payment gateway adapter unavailable.' });
    }

    const creds = {
      publicKey: gateway.publicKey,
      secretKey: decryptSecret(gateway.secretKeyEncrypted),
      webhookSecret: decryptSecret(gateway.webhookSecretEncrypted),
      mode: (gateway.mode === 'live' ? 'live' : 'test') as 'live' | 'test',
      config: gateway.config || {},
    };

    const verifyRef =
      txn.provider === 'stripe'
        ? sessionId ||
          (txn.providerPayload?.providerReference as string) ||
          reference
        : reference;

    const result = await adapter.verifyTransaction(
      verifyRef,
      creds,
      order.totalAmount
    );

    if (result.verified) {
      await db.transaction(async (tx) => {
        await tx
          .update(transactions)
          .set({
            status: 'verified',
            verifiedWithProvider: true,
            providerPayload: result.providerPayload,
          })
          .where(eq(transactions.id, txn.id));

        await tx
          .update(orders)
          .set({
            paymentStatus: 'paid',
            orderStatus: 'Paid',
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      });

      await recordEmailNotification({
        recipientEmail: order.customerEmail,
        subject: `Payment Confirmed — DIAMOND STORE Order ${order.orderNumber}`,
        eventType: 'payment_confirmed',
        payload: {
          orderNumber: order.orderNumber,
          amount: order.totalAmount,
          reference,
        },
      });
    }

    const refreshed = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order.id))
      .limit(1);

    res.json({
      verified: result.verified,
      status: result.status,
      message: result.message,
      order: refreshed[0],
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ error: 'Unable to verify transaction.' });
  }
});

// Secure Webhook Endpoint with Cryptographic Signature Verification
publicRouter.post('/webhooks/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    const adapter = getPaymentAdapter(provider);
    if (!adapter || !adapter.supportsWebhook) {
      return res.status(400).json({ error: 'Unsupported webhook provider.' });
    }

    const gwRows = await db
      .select()
      .from(paymentGateways)
      .where(eq(paymentGateways.provider, provider))
      .limit(1);
    const gateway = gwRows[0];
    if (!gateway) {
      return res.status(404).json({ error: 'Gateway not configured.' });
    }

    const creds = {
      publicKey: gateway.publicKey,
      secretKey: decryptSecret(gateway.secretKeyEncrypted),
      webhookSecret: decryptSecret(gateway.webhookSecretEncrypted),
      mode: (gateway.mode === 'live' ? 'live' : 'test') as 'live' | 'test',
      config: gateway.config || {},
    };

    const rawBody = JSON.stringify(req.body || {});
    const isValid = adapter.verifyWebhookSignature(
      rawBody,
      req.headers as Record<string, string | string[] | undefined>,
      creds
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    // Extract reference cleanly per provider payload
    const body = req.body as Record<string, any>;
    const ref =
      body?.data?.reference ||
      body?.data?.tx_ref ||
      body?.data?.object?.client_reference_id;

    if (ref) {
      const txnRows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.reference, String(ref)))
        .limit(1);
      const txn = txnRows[0];
      if (txn && !txn.verifiedWithProvider) {
        const verifyRes = await adapter.verifyTransaction(
          String(ref),
          creds,
          txn.amount
        );
        if (verifyRes.verified) {
          await db
            .update(transactions)
            .set({
              status: 'verified',
              verifiedWithProvider: true,
              providerPayload: verifyRes.providerPayload,
            })
            .where(eq(transactions.id, txn.id));

          await db
            .update(orders)
            .set({
              paymentStatus: 'paid',
              orderStatus: 'Paid',
              updatedAt: new Date(),
            })
            .where(eq(orders.id, txn.orderId));
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// Public Order Tracking
publicRouter.get('/orders/track/:orderNumber', async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.trim().toUpperCase();
    const email = (req.query.email as string | undefined)?.trim().toLowerCase();

    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    const order = rows[0];

    if (!order) {
      return res.status(404).json({ error: 'Order not found. Check your order number.' });
    }
    if (email && order.customerEmail.toLowerCase() !== email) {
      return res.status(403).json({ error: 'Email does not match this order.' });
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    res.json({
      order: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentProvider: order.paymentProvider,
        trackingNumber: order.trackingNumber,
        shippingState: order.shippingState,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        shippingFee: order.shippingFee,
        codFee: order.codFee,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      items,
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ error: 'Unable to track order.' });
  }
});

// Newsletter Subscribe
publicRouter.post('/newsletter', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    await db
      .insert(newsletterSubscribers)
      .values({ email })
      .onConflictDoNothing();
    res.json({ subscribed: true, message: 'Welcome to the DIAMOND STORE journal.' });
  } catch (error) {
    console.error('Newsletter error:', error);
    res.status(500).json({ error: 'Unable to subscribe.' });
  }
});

// Contact Us Submission
publicRouter.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
    };
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    await db.insert(contactMessages).values({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });
    res.status(201).json({ sent: true, message: 'Our Victoria Island concierge will reply shortly.' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Unable to send message.' });
  }
});
