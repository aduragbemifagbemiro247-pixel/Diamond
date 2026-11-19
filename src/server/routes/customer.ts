import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { orderItems, orders, products, users, wishlists } from '../../db/schema.ts';
import { generateRandomToken, signCustomerToken } from '../crypto.ts';
import { AppRequest, requireCustomerAuth } from '../middleware/auth.ts';
import { recordEmailNotification } from '../notifications.ts';

export const customerRouter = Router();

// Email/Password Registration
customerRouter.post('/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body as {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!fullName?.trim() || !cleanEmail || !password || password.length < 6) {
      return res.status(400).json({
        error: 'Full name, valid email, and password (min 6 characters) are required.',
      });
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);
    if (existing[0]) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db
      .insert(users)
      .values({
        email: cleanEmail,
        fullName: fullName.trim(),
        phone: (phone || '').trim(),
        passwordHash,
      })
      .returning();

    const user = inserted[0];
    const token = signCustomerToken(user.id, user.email);

    await recordEmailNotification({
      recipientEmail: user.email,
      subject: 'Welcome to DIAMOND STORE — Your Style, Your Statement.',
      eventType: 'customer_registered',
      payload: { fullName: user.fullName },
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        defaultAddress: user.defaultAddress,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// Email/Password Login
customerRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);
    const user = rows[0];

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.isSuspended) {
      return res.status(403).json({
        error: 'Your account has been suspended. Contact DIAMOND STORE support.',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signCustomerToken(user.id, user.email);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        defaultAddress: user.defaultAddress,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sign in failed.' });
  }
});

// Forgot Password
customerRouter.post('/auth/forgot-password', async (req, res) => {
  try {
    const cleanEmail = (req.body?.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);
    if (rows[0]) {
      const token = generateRandomToken(20);
      await db
        .update(users)
        .set({
          resetToken: token,
          resetExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
        })
        .where(eq(users.id, rows[0].id));

      await recordEmailNotification({
        recipientEmail: cleanEmail,
        subject: 'DIAMOND STORE — Password Reset Request',
        eventType: 'password_reset',
        payload: { resetToken: token },
      });
    }
    res.json({
      message: 'If an account matches this email, password reset instructions have been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to process password reset.' });
  }
});

// Reset Password
customerRouter.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Valid reset token and password (6+ chars) required.' });
    }
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);
    const user = rows[0];
    if (!user || !user.resetExpiresAt || new Date(user.resetExpiresAt) < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

// Sync Firebase Google Sign-In user
customerRouter.get('/customer/profile', requireCustomerAuth, async (req: AppRequest, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        defaultAddress: users.defaultAddress,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.customer!.id))
      .limit(1);
    res.json({ user: rows[0] });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Unable to load profile.' });
  }
});

customerRouter.put('/customer/profile', requireCustomerAuth, async (req: AppRequest, res) => {
  try {
    const { fullName, phone, defaultAddress } = req.body as {
      fullName?: string;
      phone?: string;
      defaultAddress?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
      };
    };

    const updated = await db
      .update(users)
      .set({
        fullName: fullName?.trim() ?? req.customer!.fullName,
        phone: phone?.trim() ?? req.customer!.phone,
        defaultAddress: defaultAddress ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.customer!.id))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        defaultAddress: users.defaultAddress,
      });

    res.json({ user: updated[0] });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
});

customerRouter.post('/customer/change-password', requireCustomerAuth, async (req: AppRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, req.customer!.id))
      .limit(1);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    if (user.passwordHash) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

// Customer Order History
customerRouter.get('/customer/orders', requireCustomerAuth, async (req: AppRequest, res) => {
  try {
    const customerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.customer!.id))
      .orderBy(desc(orders.createdAt));

    const results = await Promise.all(
      customerOrders.map(async (ord) => {
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, ord.id));
        return { ...ord, items };
      })
    );

    res.json({ orders: results });
  } catch (error) {
    console.error('Customer orders error:', error);
    res.status(500).json({ error: 'Unable to load order history.' });
  }
});

// Customer Wishlist
customerRouter.get('/customer/wishlist', requireCustomerAuth, async (req: AppRequest, res) => {
  try {
    const rows = await db
      .select({
        wishlistId: wishlists.id,
        product: products,
      })
      .from(wishlists)
      .innerJoin(products, eq(wishlists.productId, products.id))
      .where(eq(wishlists.userId, req.customer!.id))
      .orderBy(desc(wishlists.createdAt));

    res.json({
      items: rows.map((r) => ({
        ...r.product,
        effectivePrice: r.product.discountPrice ?? r.product.regularPrice,
      })),
    });
  } catch (error) {
    console.error('Wishlist fetch error:', error);
    res.status(500).json({ error: 'Unable to load wishlist.' });
  }
});

customerRouter.post('/customer/wishlist', requireCustomerAuth, async (req: AppRequest, res) => {
  try {
    const productId = Number(req.body?.productId);
    if (!productId) return res.status(400).json({ error: 'Product ID required.' });

    const existing = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, req.customer!.id), eq(wishlists.productId, productId)))
      .limit(1);

    if (!existing[0]) {
      await db.insert(wishlists).values({
        userId: req.customer!.id,
        productId,
      });
    }
    res.json({ added: true });
  } catch (error) {
    console.error('Wishlist add error:', error);
    res.status(500).json({ error: 'Unable to add to wishlist.' });
  }
});

customerRouter.delete('/customer/wishlist/:productId', requireCustomerAuth, async (req: AppRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    await db
      .delete(wishlists)
      .where(and(eq(wishlists.userId, req.customer!.id), eq(wishlists.productId, productId)));
    res.json({ removed: true });
  } catch (error) {
    console.error('Wishlist remove error:', error);
    res.status(500).json({ error: 'Unable to remove from wishlist.' });
  }
});
