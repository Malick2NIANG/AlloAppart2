'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

const PLACEHOLDER = 'https://via.placeholder.com/1600x900?text=AlloAppart';

const isVideo = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

interface Props {
  images: string[];
  title: string;
  city: string;
  price: string;
  listingId: string;
}

export default function ListingHeroCarousel({ images, title, city, price }: Props) {
  const t    = useTranslations('detail');
  const imgs = images.length > 0 ? images : [PLACEHOLDER];

  const [current, setCurrent]     = useState(0);
  const [lightbox, setLightbox]   = useState(false);
  const [gridMode, setGridMode]   = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied]       = useState(false);
  const shareRef                  = useRef<HTMLDivElement>(null);

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

  const shareWhatsapp = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://wa.me/?text=${url}`, '_blank', 'noopener');
  };

  const shareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,width=600,height=400');
  };

  const shareEmail = () => {
    const url = window.location.href;
    const subject = encodeURIComponent(`${title} – AlloAppart`);
    const body = encodeURIComponent(t('shareEmailBody', { url }));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <>
      {/* ── Hero Carousel ─────────────────────────────────────────── */}
      <div className="relative group overflow-hidden rounded-3xl border border-line shadow-2xl mb-10 bg-[#0f172a]"
        style={{ height: 'clamp(300px, 62vh, 600px)' }}>

        {/* Image ou Vidéo */}
        {isVideo(imgs[current]) ? (
          <video
            key={imgs[current]}
            src={imgs[current]}
            className="absolute inset-0 h-full w-full object-cover cursor-pointer"
            controls
            playsInline
            onClick={() => setLightbox(true)}
          />
        ) : (
          <Image
            src={imgs[current]}
            alt={title}
            fill
            className="object-cover cursor-zoom-in transition-opacity duration-500"
            onClick={() => setLightbox(true)}
            sizes="(max-width:1024px) 100vw, 900px"
            priority
          />
        )}

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

          {/* Share */}
          <div className="relative" ref={shareRef}>
            <button onClick={() => setShareOpen(!shareOpen)}
              className="h-9 w-9 grid place-items-center rounded-full bg-black/40 hover:bg-black/60 text-white transition"
              aria-label={t('shareBtn')}>
              <i className="fa-solid fa-share-nodes text-sm" />
            </button>
            {shareOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-card border border-line rounded-xl shadow-lg p-2 z-20">
                {[
                  { icon: 'fa-brands fa-whatsapp', color: 'text-green-600', label: t('shareWhatsapp'), action: shareWhatsapp },
                  { icon: 'fa-brands fa-facebook', color: 'text-blue-600',  label: t('shareFacebook'), action: shareFacebook },
                  { icon: 'fa-regular fa-envelope', color: 'text-text',     label: t('shareEmail'),    action: shareEmail    },
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

        {/* Voir toutes les photos */}
        {imgs.length > 1 && (
          <button
            onClick={() => { setGridMode(true); setLightbox(true); }}
            className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-white/90 hover:bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-lg transition"
          >
            <i className="fa-solid fa-grid-2 text-[10px]" />
            {t('viewAllPhotos', { count: imgs.length })}
          </button>
        )}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0 border-b border-white/10">
            <div className="flex items-center gap-3">
              {/* Toggle grille / carousel */}
              <button
                onClick={() => setGridMode(false)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${!gridMode ? 'bg-white text-gray-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                <i className="fa-solid fa-image text-[10px]" /> {t('photoTab')}
              </button>
              <button
                onClick={() => setGridMode(true)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${gridMode ? 'bg-white text-gray-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                <i className="fa-solid fa-grid-2 text-[10px]" /> {t('allPhotosBtn', { count: imgs.length })}
              </button>
            </div>
            {!gridMode && (
              <span className="text-sm font-medium opacity-60">{current + 1} / {imgs.length}</span>
            )}
            <button onClick={() => { setLightbox(false); setGridMode(false); }}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {gridMode ? (
            /* ── Mode grille ── */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-5xl mx-auto columns-2 md:columns-3 gap-3 space-y-3">
                {imgs.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrent(i); setGridMode(false); }}
                    className="break-inside-avoid block w-full overflow-hidden rounded-xl border-2 border-transparent hover:border-gold transition group relative"
                  >
                    {isVideo(img) ? (
                      <>
                        <video
                          src={img}
                          className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                            <i className="fa-solid fa-play text-gray-800 text-sm ml-1" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <Image
                        src={img}
                        alt={`${title} — photo ${i + 1}`}
                        width={600}
                        height={400}
                        className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Mode carousel ── */
            <>
              <div className="relative flex-1 flex items-center justify-center">
                <div className="relative w-full h-full max-w-5xl mx-auto flex items-center justify-center">
                  {isVideo(imgs[current]) ? (
                    <video
                      key={imgs[current]}
                      src={imgs[current]}
                      controls
                      playsInline
                      autoPlay
                      className="max-h-full max-w-full rounded-xl"
                    />
                  ) : (
                    <Image src={imgs[current]} alt={title} fill className="object-contain" />
                  )}
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
                <div className="shrink-0 p-4 flex gap-2 overflow-x-auto border-t border-white/10">
                  {imgs.map((img, i) => (
                    <button key={i} onClick={() => setCurrent(i)}
                      className={`relative flex-shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition ${i === current ? 'border-gold' : 'border-white/20 hover:border-white/50'}`}>
                      {isVideo(img) ? (
                        <>
                          <video src={img} className="object-cover w-full h-full" muted playsInline preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <i className="fa-solid fa-play text-white text-xs" />
                          </div>
                        </>
                      ) : (
                        <Image src={img} alt="" width={96} height={64} className="object-cover w-full h-full" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
