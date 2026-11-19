import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { db } from './src/db/index.ts';
import { products } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { publicRouter } from './src/server/routes/public.ts';
import { customerRouter } from './src/server/routes/customer.ts';
import { adminRouter } from './src/server/routes/admin.ts';

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting on auth and checkout endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again shortly.' },
  });

  app.use('/api/admin/login', authLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Serve persistent uploaded assets
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

  // SEO: robots.txt & dynamic sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/login\nSitemap: ${origin}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const published = await db
        .select({ slug: products.slug, updatedAt: products.updatedAt })
        .from(products)
        .where(eq(products.status, 'published'));

      const staticPaths = [
        '/',
        '/shop',
        '/mens-clothing',
        '/shoes',
        '/accessories',
        '/new-arrivals',
        '/best-sellers',
        '/track-order',
        '/about',
        '/contact',
        '/faq',
        '/privacy',
        '/terms',
      ];

      const urls = [
        ...staticPaths.map(
          (p) => `<url><loc>${origin}${p}</loc><changefreq>weekly</changefreq></url>`
        ),
        ...published.map(
          (p) =>
            `<url><loc>${origin}/product/${p.slug}</loc><lastmod>${new Date(
              p.updatedAt
            ).toISOString()}</lastmod></url>`
        ),
      ].join('\n');

      res
        .type('application/xml')
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
        );
    } catch {
      res.status(500).send('');
    }
  });

  // API Routes
  app.use('/api', publicRouter);
  app.use('/api', customerRouter);
  app.use('/api/admin', adminRouter);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DIAMOND STORE server listening on port ${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
