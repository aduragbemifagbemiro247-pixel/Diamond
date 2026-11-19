import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';

export function Footer() {
  const { navigate, settings, showToast } = useStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      showToast(res.message);
      setEmail('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to subscribe.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const link = (label: string, path: string) => (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        navigate(path);
      }}
      className="block text-sm text-white/70 hover:text-[#D4AF37] transition-colors py-1"
    >
      {label}
    </a>
  );

  return (
    <footer className="bg-[#111111] text-white border-t border-white/10 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="md:col-span-4 space-y-4">
            <div className="font-display text-2xl font-semibold tracking-[0.14em] text-white">
              {settings?.storeName || 'DIAMOND STORE'}
            </div>
            <p className="text-sm text-[#D4AF37] font-medium">
              {settings?.tagline || 'Your Style, Your Statement.'}
            </p>
            <p className="text-sm text-white/65 leading-relaxed max-w-sm">
              {settings?.businessAddress ||
                '14 Adeola Odeku Street, Victoria Island, Lagos, Nigeria'}
            </p>
            <p className="text-xs font-mono text-white/55 tabular-nums">
              {settings?.businessEmail || 'concierge@diamondstore.ng'} ·{' '}
              {settings?.phoneNumber || '+234 800 342 6663'}
            </p>
          </div>

          {/* Collections */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold tracking-wider text-white/90 uppercase mb-4">
              Collections
            </h4>
            {link('Shop All', '/shop')}
            {link("Men's Clothing", '/mens-clothing')}
            {link('Shoes', '/shoes')}
            {link('Accessories', '/accessories')}
            {link('New Arrivals', '/new-arrivals')}
            {link('Best Sellers', '/best-sellers')}
          </div>

          {/* Client Care */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-semibold tracking-wider text-white/90 uppercase mb-4">
              Client Care
            </h4>
            {link('Track Your Order', '/track-order')}
            {link('My Account', '/account')}
            {link('About Us', '/about')}
            {link('Contact Us', '/contact')}
            {link('Frequently Asked Questions', '/faq')}
            {link('Privacy Policy', '/privacy')}
            {link('Terms & Conditions', '/terms')}
          </div>

          {/* Newsletter */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-semibold tracking-wider text-white/90 uppercase">
              Private Journal
            </h4>
            <p className="text-sm text-white/65 leading-relaxed">
              Receive seasonal lookbooks, private trunk show invitations, and early access to limited drops.
            </p>
            <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-[#D4AF37] text-[#111111] text-xs font-semibold tracking-wider uppercase hover:bg-[#e1be4d] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Subscribing...' : 'Join Journal'}
              </button>
            </form>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <p>
            © {new Date().getFullYear()} {settings?.storeName || 'DIAMOND STORE'}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="/admin/login"
              onClick={(e) => {
                e.preventDefault();
                navigate('/admin/login');
              }}
              className="hover:text-[#D4AF37] transition-colors"
            >
              Staff & Admin Portal
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
