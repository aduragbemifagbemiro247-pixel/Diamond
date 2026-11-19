import { useState } from 'react';
import { Diamond } from 'lucide-react';

interface LuxuryImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

export function LuxuryImage({ src, alt, className = '', eager = false }: LuxuryImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-[#F5F5F5] text-[#111111]/40 p-6 text-center ${className}`}
      >
        <Diamond className="w-7 h-7 stroke-[1.25] text-[#D4AF37] mb-2" />
        <span className="text-xs tracking-wide text-[#111111]/60 line-clamp-2">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
