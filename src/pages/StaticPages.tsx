import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';

export function StaticPage({
  page,
}: {
  page: 'about' | 'contact' | 'faq' | 'privacy' | 'terms';
}) {
  const { settings, showToast, setPageMeta } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const titles = {
    about: 'About Us — DIAMOND STORE',
    contact: 'Contact Us — DIAMOND STORE',
    faq: 'Frequently Asked Questions — DIAMOND STORE',
    privacy: 'Privacy Policy — DIAMOND STORE',
    terms: 'Terms & Conditions — DIAMOND STORE',
  };

  useEffect(() => {
    setPageMeta(titles[page]);
  }, [page, setPageMeta]);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, subject, message }),
      });
      showToast(res.message);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <div className="border-b border-black/10 pb-6">
        <p className="text-xs tracking-[0.18em] text-[#8C6D14] uppercase font-medium">
          {settings?.storeName || 'DIAMOND STORE'}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111] mt-1">
          {page === 'about'
            ? 'Our House & Craft'
            : page === 'contact'
              ? 'Client Concierge'
              : page === 'faq'
                ? 'Frequently Asked Questions'
                : page === 'privacy'
                  ? 'Privacy Policy'
                  : 'Terms & Conditions'}
        </h1>
      </div>

      {page === 'about' && (
        <div className="space-y-6 text-sm sm:text-base text-[#111111]/80 leading-relaxed">
          <p>{settings?.policies?.about}</p>
          <div className="p-6 bg-[#F5F5F5] border border-black/8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div>
              <div className="font-semibold text-[#111111]">Flagship Atelier</div>
              <div className="text-[#111111]/65 mt-1">{settings?.businessAddress}</div>
            </div>
            <div>
              <div className="font-semibold text-[#111111]">Direct Concierge</div>
              <div className="text-[#111111]/65 mt-1">{settings?.phoneNumber}</div>
            </div>
            <div>
              <div className="font-semibold text-[#111111]">Client Care Email</div>
              <div className="text-[#111111]/65 mt-1">{settings?.businessEmail}</div>
            </div>
          </div>
        </div>
      )}

      {page === 'faq' && (
        <div className="space-y-4">
          {(settings?.policies?.faq || []).map((item, idx) => (
            <div key={idx} className="p-6 bg-[#F5F5F5] border border-black/8 space-y-2">
              <h2 className="font-semibold text-base text-[#111111]">{item.q}</h2>
              <p className="text-sm text-[#111111]/75 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      )}

      {(page === 'privacy' || page === 'terms') && (
        <div className="p-8 bg-[#F5F5F5] border border-black/8 text-sm text-[#111111]/80 leading-relaxed whitespace-pre-line">
          {page === 'privacy' ? settings?.policies?.privacy : settings?.policies?.terms}
        </div>
      )}

      {page === 'contact' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-4 text-sm text-[#111111]/75">
            <p>
              Visit our Victoria Island showroom or message our styling and logistics
              concierge directly.
            </p>
            <div className="p-5 bg-[#F5F5F5] border border-black/8 space-y-2 text-xs">
              <div>
                <span className="font-semibold text-[#111111]">Showroom:</span>{' '}
                {settings?.businessAddress}
              </div>
              <div>
                <span className="font-semibold text-[#111111]">Phone:</span>{' '}
                {settings?.phoneNumber}
              </div>
              <div>
                <span className="font-semibold text-[#111111]">Email:</span>{' '}
                {settings?.businessEmail}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleContact}
            className="md:col-span-7 p-6 border border-black/10 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/15 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-black/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                Message
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-black/15 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="px-7 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
