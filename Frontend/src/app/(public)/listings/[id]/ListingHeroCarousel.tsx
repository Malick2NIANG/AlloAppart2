'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';

const PLACEHOLDER = 'https://via.placeholder.com/1600x900?text=AlloAppart';

interface Props {
  images: string[];
  title: string;
  city: string;
  price: string;
  listingId: string;
}

export default function ListingHeroCarousel({ images, title, city, price }: Props) {
  const t        = useTranslations('detail');
  const { isSignedIn } = useUser();
  const router   = useRouter();
  const pathname = usePathname();
  const imgs     = images.length > 0 ? images : [PLACEHOLDER];

  const [current, setCurrent]       = useState(0);
  const [lightbox, setLightbox]     = useState(false);
  const [shareOpen, setShareOpen]   = useState(false);
  const [copied, setCopied]         = useState(false);
  const [favorited, setFavorited]   = useState(false);
  const shareRef                    = useRef<HTMLDivElement>(null);

  const handleFavorite = () => {
    if (!isSignedIn) { router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`); return; }
    setFavorited((v) => !v);
  };

  const prev = () => setCurrent((c) => (c - 1 + imgs.length) % imgs.length);
  const next = () => setCurrent((c) => (c + 1) % imgs.length);

  /* keyboard navigation */
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      setLightbox(false);
      if (e.key === 'ArrowLeft')   prev();
      if (e.key === 'ArrowRight')  next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, current]); // eslint-disable-line react-hooks/exhaustive-deps

  /* close share on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      {/* ── Hero Carousel ─────────────────────────────────────────── */}
      <div className="relative group overflow-hidden rounded-3xl border border-line shadow-2xl mb-10 bg-[#0f172a]"
        style={{ height: 'clamp(300px, 62vh, 600px)' }}>

        {/* Image */}
        <Image
          src={imgs[current]}
          alt={title}
          fill
          className="object-cover cursor-zoom-in transition-opacity duration-500"
          onClick={() => setLightbox(true)}
          sizes="(max-width:1024px) 100vw, 900px"
          priority
        />

        {/* Overlay */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Arrows */}
        {imgs.length > 1 && (
          <>
            <button onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/85 hover:bg-white text-gray-800 grid place-items-center shadow-lg transition opacity-0 group-hover:opacity-100 z-10">
              <i className="fa-solid fa-chevron-left text-sm" />
            </button>
            <button onClick={next}
              className="absolute right-14 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/85 hover:bg-white text-gray-800 grid place-items-center shadow-lg transition opacity-0 group-hover:opacity-100 z-10">
              <i className="fa-solid fa-chevron-right text-sm" />
            </button>
          </>
        )}

        {/* Top-right controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {imgs.length > 1 && (
            <span className="px-2 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
              {current + 1} / {imgs.length}
            </span>
          )}

          {/* Favorite */}
          <button onClick={handleFavorite}
            className="h-9 w-9 grid place-items-center rounded-full bg-black/40 hover:bg-black/60 text-white transition"
            aria-label="Favori">
            <svg className="h-5 w-5" fill={favorited ? '#facc15' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </button>

          {/* Share */}
          <div className="relative" ref={shareRef}>
            <button onClick={() => setShareOpen(!shareOpen)}
              className="h-9 w-9 grid place-items-center rounded-full bg-black/40 hover:bg-black/60 text-white transition"
              aria-label="Partager">
              <i className="fa-solid fa-share-nodes text-sm" />
            </button>
            {shareOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-line rounded-xl shadow-lg p-2 z-20">
                {[
                  { icon: 'fa-brands fa-whatsapp', color: 'text-green-600', label: t('shareWhatsapp') },
                  { icon: 'fa-brands fa-facebook', color: 'text-blue-600',  label: t('shareFacebook') },
                  { icon: 'fa-regular fa-envelope', color: 'text-text',     label: t('shareEmail')    },
                  { icon: 'fa-regular fa-copy',     color: 'text-text',     label: copied ? t('shareCopied') : t('shareCopy'), action: copyLink },
                ].map((item) => (
                  <button key={item.label} onClick={item.action}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gold-pale text-sm text-text transition-colors">
                    <i className={`${item.icon} ${item.color} w-4`} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Title overlay — bottom left */}
        <div className="absolute bottom-4 left-4 md:left-6 text-white drop-shadow-lg z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-sm md:text-base text-gray-100 mt-0.5">
            {city} ·{' '}
            <span className="text-gold font-semibold">{price}</span>
          </p>
        </div>

        {/* Bullets */}
        {imgs.length > 1 && (
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5 z-10">
            {imgs.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === current ? '24px' : '12px',
                  background: i === current ? '#facc15' : 'rgba(255,255,255,0.55)',
                }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 text-white shrink-0">
            <span className="text-sm opacity-70">{t('escapeHint')}</span>
            <button onClick={() => setLightbox(false)}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Image zone */}
          <div className="relative flex-1 flex items-center justify-center">
            <div className="relative w-full h-full max-w-5xl mx-auto">
              <Image src={imgs[current]} alt={title} fill className="object-contain" />
            </div>
            {imgs.length > 1 && (
              <>
                <button onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center transition">
                  <i className="fa-solid fa-chevron-left text-lg" />
                </button>
                <button onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center transition">
                  <i className="fa-solid fa-chevron-right text-lg" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {imgs.length > 1 && (
            <div className="shrink-0 p-4 flex gap-2 overflow-x-auto">
              {imgs.map((img, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={`flex-shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition ${i === current ? 'border-gold' : 'border-white/20'}`}>
                  <Image src={img} alt="" width={96} height={64} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
