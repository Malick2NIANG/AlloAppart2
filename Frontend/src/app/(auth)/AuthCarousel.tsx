'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function AuthCarousel() {
  const t = useTranslations('auth.carousel');
  const slides = t.raw('slides') as { quote: string; location: string; type: string }[];

  const [current, setCurrent] = useState(0);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % slides.length);
        setFading(false);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const IMGS = [
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
    'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=1200&q=80',
  ];

  const slide = slides[current];

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Image */}
      <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: fading ? 0 : 1 }}>
        <Image
          src={IMGS[current]}
          alt={slide.location}
          fill
          className="object-cover object-center"
          sizes="50vw"
          priority
        />
      </div>

      {/* Overlay gradient */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.20) 50%, rgba(0,0,0,0.10) 100%)' }}
      />

      {/* Logo top-left */}
      <div className="absolute top-6 left-8">
        <Image src="/images/LOGO.png" alt="AlloAppart" width={220} height={63} className="h-20 w-auto drop-shadow-lg" />
      </div>

      {/* Caption bottom */}
      <div className="absolute bottom-10 left-8 right-8 transition-opacity duration-500" style={{ opacity: fading ? 0 : 1 }}>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
          <i className="fa-solid fa-location-dot" />
          {slide.location} — {slide.type}
        </p>
        <p className="text-xl font-bold leading-snug text-white md:text-2xl">
          {slide.quote}
        </p>
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 left-8 flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === current ? '24px' : '8px',
              background: i === current ? '#facc15' : 'rgba(255,255,255,0.45)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
