export interface StoreSettings {
  id: number;
  storeName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  businessEmail: string;
  phoneNumber: string;
  whatsappNumber: string;
  businessAddress: string;
  currencySymbol: string;
  currencyCode: string;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
    tiktok?: string;
  };
  emailSettings: {
    senderName?: string;
    senderEmail?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    notifyOnOrder?: boolean;
    notifyOnStatusChange?: boolean;
  };
  policies: {
    about?: string;
    faq?: Array<{ q: string; a: string }>;
    privacy?: string;
    terms?: string;
  };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentGroup: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  isActive: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  regularPrice: number;
  discountPrice: number | null;
  effectivePrice: number;
  categoryId: number | null;
  categoryName?: string;
  categorySlug?: string;
  parentGroup?: string;
  collectionTags: string[];
  images: string[];
  mainImage: string;
  sizes: string[];
  colors: string[];
  stockQuantity: number;
  variantStock: Record<string, number>;
  isFeatured: boolean;
  isBestSeller: boolean;
  status: 'published' | 'draft' | 'hidden';
  metaTitle: string;
  metaDescription: string;
  avgRating?: number;
  reviewCount?: number;
  createdAt?: string;
}

export interface ProductReview {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
  productName?: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
  placement: 'hero' | 'promo';
  isPublished: boolean;
  displayOrder: number;
}

export interface ShippingZone {
  id: number;
  stateName: string;
  country: string;
  fee: number;
  freeDeliveryThreshold: number | null;
  estimatedDays: string;
  codAllowed: boolean;
  isActive: boolean;
}

export interface PublicPaymentMethod {
  id: number;
  provider: string;
  displayName: string;
  kind: 'online' | 'manual' | 'cod';
  description: string;
  mode: 'test' | 'live';
  publicKey: string;
  isDefault: boolean;
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    instructions?: string;
  };
  codDetails?: {
    eligibleStates?: string[];
    additionalFee?: number;
  };
}

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  sku: string;
  imageUrl: string;
  unitPrice: number;
  size: string;
  color: string;
  quantity: number;
  maxStock: number;
}

export interface CustomerUser {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  defaultAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
}

export interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  sku: string;
  imageUrl: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
  };
  shippingState: string;
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  shippingFee: number;
  codFee: number;
  totalAmount: number;
  paymentProvider: string;
  paymentReference: string | null;
  paymentStatus: string;
  orderStatus: string;
  trackingNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  fullName: string;
  role: 'super_admin' | 'store_manager' | 'content_manager';
  isActive?: boolean;
  lastLoginAt?: string;
}
