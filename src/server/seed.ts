import bcrypt from 'bcryptjs';
import { count } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  adminUsers,
  banners,
  categories,
  coupons,
  paymentGateways,
  products,
  reviews,
  shippingZones,
  storeSettings,
} from '../db/schema.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existingSettings = await db.select({ value: count() }).from(storeSettings);
  if ((existingSettings[0]?.value ?? 0) > 0) {
    return;
  }

  // 1. Store Settings
  await db.insert(storeSettings).values({
    storeName: 'DIAMOND STORE',
    tagline: 'Your Style, Your Statement.',
    businessEmail: 'concierge@diamondstore.ng',
    phoneNumber: '+234 800 342 6663',
    whatsappNumber: '2348003426663',
    businessAddress: '14 Adeola Odeku Street, Victoria Island, Lagos, Nigeria',
    currencySymbol: '₦',
    currencyCode: 'NGN',
    socialLinks: {
      instagram: 'https://instagram.com/diamondstore.ng',
      twitter: 'https://x.com/diamondstore_ng',
      facebook: 'https://facebook.com/diamondstoreng',
      tiktok: 'https://tiktok.com/@diamondstore.ng',
    },
    emailSettings: {
      senderName: 'DIAMOND STORE Concierge',
      senderEmail: 'concierge@diamondstore.ng',
      notifyOnOrder: true,
      notifyOnStatusChange: true,
    },
    policies: {
      about:
        'Founded in Victoria Island, Lagos, DIAMOND STORE crafts contemporary menswear, tailored native attire, Italian-inspired footwear, and precision accessories for discerning gentlemen across Nigeria and the diaspora. Every piece balances sharp architectural tailoring with enduring comfort.',
      faq: [
        {
          q: 'How long does delivery take within Lagos and across Nigeria?',
          a: 'Lagos Island and Mainland orders arrive within 24–48 hours. Abuja, Port Harcourt, and other Nigerian states arrive in 2–4 business days via our insured courier partners.',
        },
        {
          q: 'Do you ship internationally?',
          a: 'Yes. We ship worldwide via DHL Express to the UK, US, Canada, Europe, and across Africa within 4–6 business days.',
        },
        {
          q: 'What is your return and size exchange policy?',
          a: 'Unworn items with original tags may be exchanged or returned within 14 days of delivery. Complimentary first size exchange applies across Lagos and Abuja.',
        },
        {
          q: 'How do I confirm a Bank Transfer payment?',
          a: 'Use your generated Order Number as your transfer narration. Our finance team verifies transfers promptly and updates your order status automatically via email.',
        },
      ],
      privacy:
        'DIAMOND STORE respects your privacy. Personal details, delivery addresses, and order records are encrypted and used exclusively for order fulfillment, fraud prevention, and customer care. Payment card credentials are never stored on our servers.',
      terms:
        'All prices are listed in Nigerian Naira (₦) inclusive of VAT where applicable. Orders placed via Bank Transfer are held for 24 hours awaiting payment confirmation. Custom-hemmed native attire is eligible for tailoring adjustments within 7 days.',
    },
  });

  // 2. Seed initial Admin Users (Super Admin, Store Manager, Content Manager)
  const existingAdmins = await db.select({ value: count() }).from(adminUsers);
  if ((existingAdmins[0]?.value ?? 0) === 0) {
    const superPass = await bcrypt.hash(
      process.env.DEFAULT_SUPER_ADMIN_PASSWORD || 'DiamondAdmin!2026',
      10
    );
    const managerPass = await bcrypt.hash('ManagerPass!2026', 10);
    await db.insert(adminUsers).values([
      {
        email: process.env.DEFAULT_SUPER_ADMIN_EMAIL || 'admin@diamondstore.ng',
        username: 'diamondadmin',
        passwordHash: superPass,
        fullName: 'Adebayo Adeyemi',
        role: 'super_admin',
        isActive: true,
      },
      {
        email: 'operations@diamondstore.ng',
        username: 'storemanager',
        passwordHash: managerPass,
        fullName: 'Chidi Okafor',
        role: 'store_manager',
        isActive: true,
      },
    ]);
  }

  // 3. Seed Product Categories (Section 3)
  const categorySeed = [
    // Men's Clothing
    { name: 'T-shirts', slug: 't-shirts', parentGroup: 'mens-clothing', displayOrder: 1, imageUrl: '/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg' },
    { name: 'Polo shirts', slug: 'polo-shirts', parentGroup: 'mens-clothing', displayOrder: 2, imageUrl: '/src/assets/images/prod_silk_resort_shirt_1795101496565.jpg' },
    { name: 'Corporate shirts', slug: 'corporate-shirts', parentGroup: 'mens-clothing', displayOrder: 3, imageUrl: '/src/assets/images/prod_silk_resort_shirt_1795101496565.jpg' },
    { name: 'Native wears', slug: 'native-wears', parentGroup: 'mens-clothing', displayOrder: 4, imageUrl: '/src/assets/images/prod_agbada_onyx_1795101497844.jpg' },
    { name: 'Hoodies', slug: 'hoodies', parentGroup: 'mens-clothing', displayOrder: 5, imageUrl: '/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg' },
    { name: 'Jeans', slug: 'jeans', parentGroup: 'mens-clothing', displayOrder: 6, imageUrl: '/src/assets/images/hero_diamond_atelier_1795101494057.jpg' },
    { name: 'Trousers', slug: 'trousers', parentGroup: 'mens-clothing', displayOrder: 7, imageUrl: '/src/assets/images/hero_diamond_atelier_1795101494057.jpg' },
    { name: 'Shorts', slug: 'shorts', parentGroup: 'mens-clothing', displayOrder: 8, imageUrl: '/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg' },
    { name: 'Jackets', slug: 'jackets', parentGroup: 'mens-clothing', displayOrder: 9, imageUrl: '/src/assets/images/hero_diamond_atelier_1795101494057.jpg' },
    { name: 'Casual outfits', slug: 'casual-outfits', parentGroup: 'mens-clothing', displayOrder: 10, imageUrl: '/src/assets/images/prod_silk_resort_shirt_1795101496565.jpg' },
    // Shoes
    { name: 'Sneakers', slug: 'sneakers', parentGroup: 'shoes', displayOrder: 11, imageUrl: '/src/assets/images/prod_sneakers_obsidian_1795101497245.jpg' },
    { name: 'Corporate shoes', slug: 'corporate-shoes', parentGroup: 'shoes', displayOrder: 12, imageUrl: '/src/assets/images/banner_footwear_edit_1795101496867.jpg' },
    { name: 'Loafers', slug: 'loafers', parentGroup: 'shoes', displayOrder: 13, imageUrl: '/src/assets/images/prod_loafers_cognac_1795101496526.jpg' },
    { name: 'Slides', slug: 'slides', parentGroup: 'shoes', displayOrder: 14, imageUrl: '/src/assets/images/prod_loafers_cognac_1795101496526.jpg' },
    { name: 'Sandals', slug: 'sandals', parentGroup: 'shoes', displayOrder: 15, imageUrl: '/src/assets/images/prod_loafers_cognac_1795101496526.jpg' },
    { name: 'Boots', slug: 'boots', parentGroup: 'shoes', displayOrder: 16, imageUrl: '/src/assets/images/banner_footwear_edit_1795101496867.jpg' },
    { name: 'Sports shoes', slug: 'sports-shoes', parentGroup: 'shoes', displayOrder: 17, imageUrl: '/src/assets/images/prod_sneakers_obsidian_1795101497245.jpg' },
    // Men's Accessories
    { name: 'Wristwatches', slug: 'wristwatches', parentGroup: 'accessories', displayOrder: 18, imageUrl: '/src/assets/images/prod_chronograph_watch_1795101497542.jpg' },
    { name: 'Sunglasses', slug: 'sunglasses', parentGroup: 'accessories', displayOrder: 19, imageUrl: '/src/assets/images/prod_sunglasses_aviator_1795101497427.jpg' },
    { name: 'Belts', slug: 'belts', parentGroup: 'accessories', displayOrder: 20, imageUrl: '/src/assets/images/prod_leather_duffel_1795101497413.jpg' },
    { name: 'Wallets', slug: 'wallets', parentGroup: 'accessories', displayOrder: 21, imageUrl: '/src/assets/images/prod_leather_duffel_1795101497413.jpg' },
    { name: 'Caps', slug: 'caps', parentGroup: 'accessories', displayOrder: 22, imageUrl: '/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg' },
    { name: 'Necklaces', slug: 'necklaces', parentGroup: 'accessories', displayOrder: 23, imageUrl: '/src/assets/images/prod_chronograph_watch_1795101497542.jpg' },
    { name: 'Bracelets', slug: 'bracelets', parentGroup: 'accessories', displayOrder: 24, imageUrl: '/src/assets/images/prod_chronograph_watch_1795101497542.jpg' },
    { name: 'Rings', slug: 'rings', parentGroup: 'accessories', displayOrder: 25, imageUrl: '/src/assets/images/prod_chronograph_watch_1795101497542.jpg' },
    { name: 'Neck ties', slug: 'neck-ties', parentGroup: 'accessories', displayOrder: 26, imageUrl: '/src/assets/images/prod_silk_resort_shirt_1795101496565.jpg' },
    { name: 'Bags', slug: 'bags', parentGroup: 'accessories', displayOrder: 27, imageUrl: '/src/assets/images/prod_leather_duffel_1795101497413.jpg' },
  ];

  const insertedCats = await db.insert(categories).values(categorySeed).returning();
  const catMap = new Map(insertedCats.map((c) => [c.slug, c.id]));

  // 4. Seed Products
  const productSeed: Array<typeof products.$inferInsert> = [
    {
      name: 'Victoria Island Obsidian Senator Set',
      slug: 'victoria-island-obsidian-senator-set',
      sku: 'DMND-NAT-001',
      description:
        'Precision-tailored Nigerian contemporary two-piece Senator kaftan woven from breathable luxury wool-cashmere blend with subtle hand-guided gold geometric embroidery along the collar and placket.',
      regularPrice: 125000,
      discountPrice: 108000,
      categoryId: catMap.get('native-wears') || null,
      collectionTags: ['New Arrivals', 'Premium Collection', 'Featured Products'],
      mainImage: '/src/assets/images/prod_agbada_onyx_1795101497844.jpg',
      images: [
        '/src/assets/images/prod_agbada_onyx_1795101497844.jpg',
        '/src/assets/images/hero_diamond_atelier_1795101494057.jpg',
      ],
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Obsidian Black', 'Midnight Navy'],
      stockQuantity: 28,
      variantStock: {
        'M / Obsidian Black': 8,
        'L / Obsidian Black': 10,
        'XL / Obsidian Black': 6,
        'XXL / Midnight Navy': 4,
      },
      isFeatured: true,
      isBestSeller: true,
      status: 'published',
      metaTitle: 'Victoria Island Obsidian Senator Set | DIAMOND STORE',
      metaDescription: 'Luxury tailored Nigerian Senator native wear in obsidian black with subtle gold embroidery.',
    },
    {
      name: 'Ikoyi Sovereign Chronograph Watch',
      slug: 'ikoyi-sovereign-chronograph-watch',
      sku: 'DMND-ACC-002',
      description:
        'Brushed 18k gold-tone stainless steel case paired with a matte obsidian dial, sapphire crystal, Swiss-grade quartz chronograph movement, and hand-stitched alligator-embossed calfskin strap.',
      regularPrice: 285000,
      discountPrice: 245000,
      categoryId: catMap.get('wristwatches') || null,
      collectionTags: ['Trending Products', 'Best Sellers', 'Premium Collection', 'Featured Products'],
      mainImage: '/src/assets/images/prod_chronograph_watch_1795101497542.jpg',
      images: ['/src/assets/images/prod_chronograph_watch_1795101497542.jpg'],
      sizes: ['41mm'],
      colors: ['Gold / Black'],
      stockQuantity: 14,
      variantStock: { '41mm / Gold / Black': 14 },
      isFeatured: true,
      isBestSeller: true,
      status: 'published',
      metaTitle: 'Ikoyi Sovereign Chronograph Watch | DIAMOND STORE',
      metaDescription: 'Brushed gold chronograph wristwatch with matte black dial and leather strap.',
    },
    {
      name: 'Milano Obsidian Leather Sneakers',
      slug: 'milano-obsidian-leather-sneakers',
      sku: 'DMND-SHO-003',
      description:
        'Low-top minimalist sneakers crafted from full-grain Italian calfskin leather with tonal waxed cotton laces, calfskin lining, and an architectural ivory rubber cupsole.',
      regularPrice: 95000,
      discountPrice: null,
      categoryId: catMap.get('sneakers') || null,
      collectionTags: ['New Arrivals', 'Best Sellers', 'Featured Products'],
      mainImage: '/src/assets/images/prod_sneakers_obsidian_1795101497245.jpg',
      images: ['/src/assets/images/prod_sneakers_obsidian_1795101497245.jpg'],
      sizes: ['41', '42', '43', '44', '45'],
      colors: ['Obsidian / Ivory'],
      stockQuantity: 32,
      variantStock: {
        '41 / Obsidian / Ivory': 5,
        '42 / Obsidian / Ivory': 8,
        '43 / Obsidian / Ivory': 10,
        '44 / Obsidian / Ivory': 6,
        '45 / Obsidian / Ivory': 3,
      },
      isFeatured: true,
      isBestSeller: true,
      status: 'published',
      metaTitle: 'Milano Obsidian Leather Sneakers | DIAMOND STORE',
      metaDescription: 'Minimalist full-grain black calfskin sneakers with ivory cupsole.',
    },
    {
      name: 'Riviera Cognac Suede Penny Loafers',
      slug: 'riviera-cognac-suede-penny-loafers',
      sku: 'DMND-SHO-004',
      description:
        'Hand-lasted burnished cognac suede loafers featuring Blake-stitched leather outsoles, cushioned leather footbeds, and timeless executive proportions suitable for native or tailored wear.',
      regularPrice: 112000,
      discountPrice: 96000,
      categoryId: catMap.get('loafers') || null,
      collectionTags: ['Trending Products', 'Discount Products', 'Featured Products'],
      mainImage: '/src/assets/images/prod_loafers_cognac_1795101496526.jpg',
      images: [
        '/src/assets/images/prod_loafers_cognac_1795101496526.jpg',
        '/src/assets/images/banner_footwear_edit_1795101496867.jpg',
      ],
      sizes: ['41', '42', '43', '44', '45'],
      colors: ['Burnished Cognac', 'Espresso Suede'],
      stockQuantity: 19,
      variantStock: {
        '41 / Burnished Cognac': 3,
        '42 / Burnished Cognac': 6,
        '43 / Burnished Cognac': 5,
        '44 / Burnished Cognac': 3,
        '45 / Espresso Suede': 2,
      },
      isFeatured: true,
      isBestSeller: false,
      status: 'published',
      metaTitle: 'Riviera Cognac Suede Penny Loafers | DIAMOND STORE',
      metaDescription: 'Handcrafted burnished cognac suede penny loafers with stacked leather heel.',
    },
    {
      name: 'Atelier Heavyweight Supima Tee',
      slug: 'atelier-heavyweight-supima-tee',
      sku: 'DMND-CLO-005',
      description:
        '310gsm organic Supima combed cotton crewneck t-shirt tailored with a structured collar rib and refined drape that elevates everyday layering.',
      regularPrice: 38000,
      discountPrice: 32000,
      categoryId: catMap.get('t-shirts') || null,
      collectionTags: ['New Arrivals', 'Best Sellers', 'Discount Products'],
      mainImage: '/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg',
      images: ['/src/assets/images/prod_tshirt_gold_crest_1795101496772.jpg'],
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Jet Black', 'Chalk White'],
      stockQuantity: 45,
      variantStock: {
        'S / Jet Black': 8,
        'M / Jet Black': 15,
        'L / Jet Black': 12,
        'XL / Jet Black': 10,
      },
      isFeatured: false,
      isBestSeller: true,
      status: 'published',
      metaTitle: 'Atelier Heavyweight Supima Tee | DIAMOND STORE',
      metaDescription: '310gsm heavyweight Supima cotton luxury crewneck t-shirt.',
    },
    {
      name: 'Sandstone Striped Executive Shirt',
      slug: 'sandstone-striped-executive-shirt',
      sku: 'DMND-CLO-006',
      description:
        'Two-fold Egyptian cotton corporate dress shirt with subtle ivory-sand micro-stripes, crisp semi-spread collar, and genuine mother-of-pearl buttons.',
      regularPrice: 64000,
      discountPrice: null,
      categoryId: catMap.get('corporate-shirts') || null,
      collectionTags: ['New Arrivals', 'Featured Products'],
      mainImage: '/src/assets/images/prod_silk_resort_shirt_1795101496565.jpg',
      images: ['/src/assets/images/prod_silk_resort_shirt_1795101496565.jpg'],
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Ivory Sand'],
      stockQuantity: 24,
      variantStock: {
        'M / Ivory Sand': 6,
        'L / Ivory Sand': 8,
        'XL / Ivory Sand': 6,
        'XXL / Ivory Sand': 4,
      },
      isFeatured: true,
      isBestSeller: false,
      status: 'published',
      metaTitle: 'Sandstone Striped Executive Shirt | DIAMOND STORE',
      metaDescription: 'Two-fold Egyptian cotton corporate shirt with mother-of-pearl buttons.',
    },
    {
      name: 'Eko Heritage Pebbled Leather Weekender',
      slug: 'eko-heritage-pebbled-leather-weekender',
      sku: 'DMND-ACC-007',
      description:
        'Structured travel duffel handcrafted from supple pebbled full-grain cowhide leather with brushed gold brass hardware, padded laptop sleeve, and detachable shoulder strap.',
      regularPrice: 215000,
      discountPrice: 189000,
      categoryId: catMap.get('bags') || null,
      collectionTags: ['Premium Collection', 'Trending Products', 'Discount Products'],
      mainImage: '/src/assets/images/prod_leather_duffel_1795101497413.jpg',
      images: ['/src/assets/images/prod_leather_duffel_1795101497413.jpg'],
      sizes: ['One Size'],
      colors: ['Obsidian Black'],
      stockQuantity: 11,
      variantStock: { 'One Size / Obsidian Black': 11 },
      isFeatured: true,
      isBestSeller: true,
      status: 'published',
      metaTitle: 'Eko Heritage Pebbled Leather Weekender | DIAMOND STORE',
      metaDescription: 'Full-grain pebbled black leather weekender bag with brushed gold hardware.',
    },
    {
      name: 'Solstice Brushed Gold Aviators',
      slug: 'solstice-brushed-gold-aviators',
      sku: 'DMND-ACC-008',
      description:
        'Lightweight titanium-alloy aviator frames finished in brushed 18k gold plating with anti-reflective polarized dark smoke CR-39 lenses.',
      regularPrice: 78000,
      discountPrice: null,
      categoryId: catMap.get('sunglasses') || null,
      collectionTags: ['New Arrivals', 'Trending Products'],
      mainImage: '/src/assets/images/prod_sunglasses_aviator_1795101497427.jpg',
      images: ['/src/assets/images/prod_sunglasses_aviator_1795101497427.jpg'],
      sizes: ['58mm'],
      colors: ['Brushed Gold / Smoke'],
      stockQuantity: 22,
      variantStock: { '58mm / Brushed Gold / Smoke': 22 },
      isFeatured: false,
      isBestSeller: true,
      status: 'published',
      metaTitle: 'Solstice Brushed Gold Aviators | DIAMOND STORE',
      metaDescription: 'Brushed gold titanium aviator sunglasses with polarized smoke lenses.',
    },
    {
      name: 'Mayfair Obsidian Chelsea Boots',
      slug: 'mayfair-obsidian-chelsea-boots',
      sku: 'DMND-SHO-009',
      description:
        'Whole-cut black box-calfskin Chelsea boots built on a sleek almond toe last with Goodyear-welted storm soles for rainy Lagos streets and crisp evening suiting.',
      regularPrice: 148000,
      discountPrice: 132000,
      categoryId: catMap.get('boots') || null,
      collectionTags: ['Premium Collection', 'Best Sellers'],
      mainImage: '/src/assets/images/banner_footwear_edit_1795101496867.jpg',
      images: ['/src/assets/images/banner_footwear_edit_1795101496867.jpg'],
      sizes: ['41', '42', '43', '44', '45'],
      colors: ['Obsidian Calf'],
      stockQuantity: 4, // Intentionally low stock to demonstrate low-stock alerts in admin!
      variantStock: {
        '42 / Obsidian Calf': 2,
        '43 / Obsidian Calf': 2,
      },
      isFeatured: true,
      isBestSeller: true,
      status: 'published',
      metaTitle: 'Mayfair Obsidian Chelsea Boots | DIAMOND STORE',
      metaDescription: 'Goodyear-welted black box-calfskin Chelsea boots.',
    },
    {
      name: 'Savile Linen-Wool Architectural Blazer',
      slug: 'savile-linen-wool-architectural-blazer',
      sku: 'DMND-CLO-010',
      description:
        'Unstructured single-breasted blazer tailored in a tropical-weight Italian linen-wool hopsack weave with horn buttons and breathable Bemberg cupro lining.',
      regularPrice: 195000,
      discountPrice: null,
      categoryId: catMap.get('jackets') || null,
      collectionTags: ['Premium Collection', 'Featured Products', 'New Arrivals'],
      mainImage: '/src/assets/images/hero_diamond_atelier_1795101494057.jpg',
      images: ['/src/assets/images/hero_diamond_atelier_1795101494057.jpg'],
      sizes: ['M', 'L', 'XL'],
      colors: ['Obsidian Black'],
      stockQuantity: 12,
      variantStock: {
        'M / Obsidian Black': 4,
        'L / Obsidian Black': 5,
        'XL / Obsidian Black': 3,
      },
      isFeatured: true,
      isBestSeller: false,
      status: 'published',
      metaTitle: 'Savile Linen-Wool Architectural Blazer | DIAMOND STORE',
      metaDescription: 'Tropical-weight black linen-wool tailored blazer.',
    },
  ];

  const insertedProducts = await db.insert(products).values(productSeed).returning();

  // 5. Seed initial customer reviews
  if (insertedProducts.length >= 3) {
    await db.insert(reviews).values([
      {
        productId: insertedProducts[0].id,
        customerName: 'Tunde Bakare',
        rating: 5,
        comment:
          'The wool-cashmere drape on the Senator set is unmatched. Wore it to a wedding in Ikoyi and received compliments all evening.',
        isApproved: true,
      },
      {
        productId: insertedProducts[1].id,
        customerName: 'Kelechi Nwosu',
        rating: 5,
        comment:
          'Weighty brushed gold bezel and clean dial finish. Arrived in Abuja within 48 hours in presentation packaging.',
        isApproved: true,
      },
      {
        productId: insertedProducts[2].id,
        customerName: 'Femi Adewale',
        rating: 5,
        comment:
          'Soft Italian leather right out of the box—no break-in period required.',
        isApproved: true,
      },
    ]);
  }

  // 6. Seed Shipping Zones
  await db.insert(shippingZones).values([
    { stateName: 'Lagos (Island & Victoria Island)', country: 'Nigeria', fee: 3000, freeDeliveryThreshold: 150000, estimatedDays: 'Same Day / 24 Hours', codAllowed: true, isActive: true },
    { stateName: 'Lagos (Mainland)', country: 'Nigeria', fee: 4000, freeDeliveryThreshold: 150000, estimatedDays: '1–2 Business Days', codAllowed: true, isActive: true },
    { stateName: 'Abuja (FCT)', country: 'Nigeria', fee: 6500, freeDeliveryThreshold: 200000, estimatedDays: '2–3 Business Days', codAllowed: true, isActive: true },
    { stateName: 'Rivers (Port Harcourt)', country: 'Nigeria', fee: 7500, freeDeliveryThreshold: 220000, estimatedDays: '2–4 Business Days', codAllowed: false, isActive: true },
    { stateName: 'Oyo (Ibadan)', country: 'Nigeria', fee: 5500, freeDeliveryThreshold: 180000, estimatedDays: '2–3 Business Days', codAllowed: false, isActive: true },
    { stateName: 'Other Nigerian States', country: 'Nigeria', fee: 8500, freeDeliveryThreshold: 250000, estimatedDays: '3–5 Business Days', codAllowed: false, isActive: true },
    { stateName: 'International (DHL Express)', country: 'International', fee: 45000, freeDeliveryThreshold: 600000, estimatedDays: '4–6 Business Days', codAllowed: false, isActive: true },
  ]);

  // 7. Seed Payment Gateways (Dynamic—Bank Transfer & COD active initially; Paystack/Flutterwave/Stripe ready to configure in Admin)
  await db.insert(paymentGateways).values([
    {
      provider: 'bank_transfer',
      displayName: 'Instant Corporate Bank Transfer',
      mode: 'live',
      publicKey: '',
      secretKeyEncrypted: '',
      webhookSecretEncrypted: '',
      config: {
        bankName: 'Providus Bank PLC',
        accountName: 'DIAMOND STORE LUXURY LTD',
        accountNumber: '1304829510',
        instructions:
          'Please include your Order Number as your transfer narration. Our concierge team confirms transfers promptly.',
      },
      isActive: true,
      isDefault: true,
      lastTestStatus: 'connected',
      lastTestedAt: new Date(),
    },
    {
      provider: 'cash_on_delivery',
      displayName: 'Pay on Delivery (Cash / POS)',
      mode: 'live',
      publicKey: '',
      secretKeyEncrypted: '',
      webhookSecretEncrypted: '',
      config: {
        eligibleStates: ['Lagos (Island & Victoria Island)', 'Lagos (Mainland)', 'Abuja (FCT)'],
        additionalFee: 1500,
      },
      isActive: true,
      isDefault: false,
      lastTestStatus: 'connected',
      lastTestedAt: new Date(),
    },
  ]);

  // 8. Seed Coupons
  await db.insert(coupons).values([
    {
      code: 'DIAMOND10',
      discountType: 'percentage',
      discountValue: 10,
      minPurchase: 30000,
      maxUses: 500,
      isActive: true,
    },
    {
      code: 'LAGOSVIP',
      discountType: 'fixed',
      discountValue: 5000,
      minPurchase: 60000,
      maxUses: 200,
      isActive: true,
    },
  ]);

  // 9. Seed Website Banners
  await db.insert(banners).values([
    {
      title: 'Your Style, Your Statement.',
      subtitle:
        'Discover premium clothing, stylish footwear and accessories designed to elevate your everyday look.',
      imageUrl: '/src/assets/images/hero_diamond_atelier_1795101494057.jpg',
      buttonText: 'SHOP NOW',
      buttonLink: '/shop',
      placement: 'hero',
      isPublished: true,
      displayOrder: 1,
    },
    {
      title: 'The Signature Footwear Edit',
      subtitle:
        'Hand-lasted Italian calfskin boots, burnished suede loafers, and minimalist obsidian sneakers.',
      imageUrl: '/src/assets/images/banner_footwear_edit_1795101496867.jpg',
      buttonText: 'EXPLORE COLLECTION',
      buttonLink: '/shoes',
      placement: 'promo',
      isPublished: true,
      displayOrder: 2,
    },
  ]);
}
