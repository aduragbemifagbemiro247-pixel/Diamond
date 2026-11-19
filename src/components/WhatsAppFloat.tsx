import { MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function WhatsAppFloat() {
  const { settings, currentPath } = useStore();
  if (currentPath.startsWith('/admin')) return null;

  const phone = (settings?.whatsappNumber || '2348003426663').replace(/\D/g, '');
  const text = encodeURIComponent(
    `Hello ${settings?.storeName || 'DIAMOND STORE'} Concierge, I would like assistance with an order.`
  );

  return (
    <a
      href={`https://wa.me/${phone}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 bg-[#111111] text-white border border-[#D4AF37]/60 shadow-lg hover:bg-[#1d1d1d] transition-colors no-print"
    >
      <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
      <span className="hidden sm:inline text-xs font-medium tracking-wide">
        Concierge
      </span>
    </a>
  );
}
