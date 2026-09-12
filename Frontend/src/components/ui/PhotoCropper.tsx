'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  src: string;           // URL ou object URL de l'image à ajuster
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  onError?: () => void;  // ex : image distante non chargeable (CORS)
}

// Cadre 4:3 — même ratio que les vignettes de la grille d'upload
// (ImageUploadZone), pour une cohérence visuelle avec le reste du site.
const SIZE_W  = 480;
const SIZE_H  = 360;
const OUTPUT_W = 1440;
const OUTPUT_H = 1080;

/**
 * Variante rectangulaire (4:3) du recadrage utilisé pour la photo de profil
 * (AvatarCropper) — même interaction (glisser pour repositionner, curseur
 * pour zoomer), sans le clip circulaire puisqu'ici tout le cadre est la
 * zone recadrée.
 */
export default function PhotoCropper({ src, onConfirm, onCancel, onError }: Props) {
  const t         = useTranslations('cropper');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale,  setScale]  = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [ready, setReady] = useState(false);

  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  /* ── Charger l'image ──────────────────────────────────────── */
  useEffect(() => {
    setReady(false);
    const img = new Image();
    img.crossOrigin = 'anonymous'; // évite un canvas "tainted" pour une image distante (Cloudinary)
    img.onload = () => {
      imgRef.current = img;
      // centrer + ajuster le zoom initial pour couvrir tout le cadre (object-cover)
      const base = Math.max(SIZE_W / img.naturalWidth, SIZE_H / img.naturalHeight);
      setScale(base);
      setMinScale(base);
      setOffset({ x: SIZE_W / 2, y: SIZE_H / 2 });
      setReady(true);
    };
    img.onerror = () => onError?.();
    img.src = src;
  }, [src, onError]);

  /* ── Dessiner ─────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE_W, SIZE_H);
    const w = img.naturalWidth  * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, offset.x - w / 2, offset.y - h / 2, w, h);

    // cadre
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, SIZE_W - 2, SIZE_H - 2);
  }, [offset, scale]);

  useEffect(() => { draw(); }, [draw]);

  /* ── Drag ─────────────────────────────────────────────────── */
  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.startX),
      y: drag.current.oy + (e.clientY - drag.current.startY),
    });
  }, []);
  const onMouseUp = useCallback(() => { drag.current = null; }, []);

  /* Touch */
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    drag.current = { startX: touch.clientX, startY: touch.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (!drag.current) return;
    const touch = e.touches[0];
    setOffset({
      x: drag.current.ox + (touch.clientX - drag.current.startX),
      y: drag.current.oy + (touch.clientY - drag.current.startY),
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',  onMouseUp);
    const canvas = canvasRef.current;
    canvas?.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',  onMouseUp);
      canvas?.removeEventListener('touchmove', onTouchMove);
    };
  }, [onMouseMove, onMouseUp, onTouchMove]);

  /* ── Confirmer → rendre sur canvas OUTPUT_W×OUTPUT_H ───────── */
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;

    const out  = document.createElement('canvas');
    out.width  = OUTPUT_W;
    out.height = OUTPUT_H;
    const ctx  = out.getContext('2d');
    if (!ctx) return;

    const ratio = OUTPUT_W / SIZE_W; // SIZE_W/SIZE_H et OUTPUT_W/OUTPUT_H ont le même ratio 4:3
    const w  = img.naturalWidth  * scale * ratio;
    const h  = img.naturalHeight * scale * ratio;
    const ox = offset.x * ratio;
    const oy = offset.y * ratio;

    try {
      ctx.drawImage(img, ox - w / 2, oy - h / 2, w, h);
      out.toBlob(
        (blob) => { if (blob) onConfirm(blob); else onError?.(); },
        'image/jpeg',
        0.9,
      );
    } catch {
      onError?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex flex-col items-center gap-5 rounded-2xl bg-card p-6 shadow-2xl w-full max-w-md">

        <h2 className="text-sm font-bold text-text">{t('title')}</h2>
        <p className="text-xs text-sub -mt-3">{t('hint')}</p>

        {!ready ? (
          <div className="flex items-center justify-center" style={{ width: SIZE_W, height: SIZE_H }}>
            <i className="fa-solid fa-spinner fa-spin text-gold-dark text-xl" />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={SIZE_W}
            height={SIZE_H}
            className="rounded-xl cursor-grab active:cursor-grabbing select-none"
            style={{ width: SIZE_W, height: SIZE_H }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          />
        )}

        {/* Zoom slider */}
        <div className="w-full flex items-center gap-3">
          <i className="fa-solid fa-magnifying-glass-minus text-sub text-xs" />
          <input
            type="range"
            min={minScale}
            max={minScale * 4}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            disabled={!ready}
            className="flex-1 accent-gold"
          />
          <i className="fa-solid fa-magnifying-glass-plus text-sub text-xs" />
        </div>

        {/* Actions */}
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-line py-2 text-sm font-semibold text-sub hover:border-gold/40 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ready}
            className="flex-1 rounded-full bg-gold py-2 text-sm font-bold text-white hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {t('confirm')}
          </button>
        </div>

      </div>
    </div>
  );
}
