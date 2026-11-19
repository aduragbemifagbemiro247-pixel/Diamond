import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Customer Users (linked to Firebase Auth UID for Google Sign-In and/or passwordHash for email login)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  fullName: text('full_name').notNull().default(''),
  phone: text('phone').notNull().default(''),
  defaultAddress: jsonb('default_address').$type<{
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  }>(),
  isSuspended: boolean('is_suspended').notNull().default(false),
  resetToken: text('reset_token'),
  resetExpiresAt: timestamp('reset_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Separate Administrator Users (strictly isolated from customer accounts)
export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('store_manager'), // 'super_admin' | 'store_manager' | 'content_manager'
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  resetToken: text('reset_token'),
  resetExpiresAt: timestamp('reset_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Admin Sessions
export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .references(() => adminUsers.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  userAgent: text('user_agent').notNull().default(''),
  ipAddress: text('ip_address').notNull().default(''),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  parentGroup: text('parent_group').notNull().default('mens-clothing'), // 'mens-clothing' | 'shoes' | 'accessories' | 'collections'
  description: text('description').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Products
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sku: text('sku').notNull().unique(),
  description: text('description').notNull(),
  regularPrice: integer('regular_price').notNull(),
  discountPrice: integer('discount_price'),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'set null' }),
  collectionTags: jsonb('collection_tags').$type<string[]>().notNull().default([]),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  mainImage: text('main_image').notNull(),
  sizes: jsonb('sizes').$type<string[]>().notNull().default([]),
  colors: jsonb('colors').$type<string[]>().notNull().default([]),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  variantStock: jsonb('variant_stock').$type<Record<string, number>>().notNull().default({}),
  isFeatured: boolean('is_featured').notNull().default(false),
  isBestSeller: boolean('is_best_seller').notNull().default(false),
  status: text('status').notNull().default('published'), // 'published' | 'draft' | 'hidden'
  metaTitle: text('meta_title').notNull().default(''),
  metaDescription: text('meta_description').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Product Reviews
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  isApproved: boolean('is_approved').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Wishlists
export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Dynamic Payment Gateways
export const paymentGateways = pgTable('payment_gateways', {
  id: serial('id').primaryKey(),
  provider: text('provider').notNull(), // 'paystack' | 'flutterwave' | 'stripe' | 'bank_transfer' | 'cash_on_delivery'
  displayName: text('display_name').notNull(),
  mode: text('mode').notNull().default('test'), // 'test' | 'live'
  publicKey: text('public_key').notNull().default(''),
  secretKeyEncrypted: text('secret_key_encrypted').notNull().default(''),
  webhookSecretEncrypted: text('webhook_secret_encrypted').notNull().default(''),
  config: jsonb('config').$type<{
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    instructions?: string;
    eligibleStates?: string[];
    additionalFee?: number;
  }>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  lastTestedAt: timestamp('last_tested_at'),
  lastTestStatus: text('last_test_status').notNull().default('untested'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Shipping Zones
export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  stateName: text('state_name').notNull().unique(),
  country: text('country').notNull().default('Nigeria'),
  fee: integer('fee').notNull().default(3500),
  freeDeliveryThreshold: integer('free_delivery_threshold'),
  estimatedDays: text('estimated_days').notNull().default('2-4 Business Days'),
  codAllowed: boolean('cod_allowed').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
});

// 10. Coupons & Discounts
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  discountType: text('discount_type').notNull().default('percentage'), // 'percentage' | 'fixed'
  discountValue: integer('discount_value').notNull(),
  minPurchase: integer('min_purchase').notNull().default(0),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Orders
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  shippingAddress: jsonb('shipping_address').$type<{
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
  }>().notNull(),
  shippingState: text('shipping_state').notNull(),
  subtotal: integer('subtotal').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  couponCode: text('coupon_code'),
  shippingFee: integer('shipping_fee').notNull().default(0),
  codFee: integer('cod_fee').notNull().default(0),
  totalAmount: integer('total_amount').notNull(),
  paymentProvider: text('payment_provider').notNull(),
  paymentReference: text('payment_reference').unique(),
  paymentStatus: text('payment_status').notNull().default('pending'), // 'pending' | 'paid' | 'failed' | 'refunded'
  orderStatus: text('order_status').notNull().default('Pending Payment'),
  trackingNumber: text('tracking_number').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 12. Order Items
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  imageUrl: text('image_url').notNull(),
  size: text('size').notNull().default(''),
  color: text('color').notNull().default(''),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
});

// 13. Payment Transactions
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').notNull(),
  reference: text('reference').notNull().unique(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('NGN'),
  status: text('status').notNull().default('initiated'), // 'initiated' | 'verified' | 'failed' | 'refunded'
  verifiedWithProvider: boolean('verified_with_provider').notNull().default(false),
  providerPayload: jsonb('provider_payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Website Banners
export const banners = pgTable('banners', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  imageUrl: text('image_url').notNull(),
  buttonText: text('button_text').notNull().default('SHOP NOW'),
  buttonLink: text('button_link').notNull().default('/shop'),
  placement: text('placement').notNull().default('hero'), // 'hero' | 'promo'
  isPublished: boolean('is_published').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Store Settings
export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  storeName: text('store_name').notNull().default('DIAMOND STORE'),
  tagline: text('tagline').notNull().default('Your Style, Your Statement.'),
  logoUrl: text('logo_url').notNull().default(''),
  faviconUrl: text('favicon_url').notNull().default(''),
  businessEmail: text('business_email').notNull().default('concierge@diamondstore.ng'),
  phoneNumber: text('phone_number').notNull().default('+234 800 342 6663'),
  whatsappNumber: text('whatsapp_number').notNull().default('2348003426663'),
  businessAddress: text('business_address').notNull().default('14 Adeola Odeku Street, Victoria Island, Lagos, Nigeria'),
  currencySymbol: text('currency_symbol').notNull().default('₦'),
  currencyCode: text('currency_code').notNull().default('NGN'),
  socialLinks: jsonb('social_links').$type<{
    instagram?: string;
    twitter?: string;
    facebook?: string;
    tiktok?: string;
  }>().notNull().default({}),
  emailSettings: jsonb('email_settings').$type<{
    senderName?: string;
    senderEmail?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    notifyOnOrder?: boolean;
    notifyOnStatusChange?: boolean;
  }>().notNull().default({}),
  policies: jsonb('policies').$type<{
    about?: string;
    faq?: Array<{ q: string; a: string }>;
    privacy?: string;
    terms?: string;
  }>().notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 16. Email Notification Logs
export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  eventType: text('event_type').notNull(),
  status: text('status').notNull().default('queued'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Admin Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: text('ip_address').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Newsletter Subscribers
export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Contact Messages
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  transactions: many(transactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  order: one(orders, {
    fields: [transactions.orderId],
    references: [orders.id],
  }),
}));
