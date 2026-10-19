'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { pointerToCanvas } from '@/lib/pointerToCanvas';

interface Props {
  src: string;           // object URL de l'image sélectionnée
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const SIZE = 320;        // taille du canvas d'affichage (px)
const OUTPUT = 400;      // taille du fichier de sortie (px)

export default function AvatarCropper({ src, onConfirm, onCancel }: Props) {
  const t         = useTranslations('cropper');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);

  // offset du centre de l'image dans le canvas (en pixels canvas)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale,  setScale]  = useState(1);

  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  /* ── Charger l'image ──────────────────────────────────────── */
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // centrer + ajuster le zoom initial pour remplir le cercle
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const baseScale = SIZE / minDim;
      setScale(baseScale);
      setOffset({ x: SIZE / 2, y: SIZE / 2 });
    };
    img.src = src;
  }, [src]);

  /* ── Dessiner ─────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // image
    const w = img.naturalWidth  * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, offset.x - w / 2, offset.y - h / 2, w, h);

    // overlay sombre en dehors du cercle
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2, true);
    ctx.fill('evenodd');

    // cercle blanc
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [offset, scale]);

  useEffect(() => { draw(); }, [draw]);

  /* ── Drag ─────────────────────────────────────────────────── */
  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  /**
   * Convertit un déplacement en pixels CSS (espace client) en déplacement
   * dans le repère interne du canvas — nécessaire car le canvas peut
   * s'afficher plus petit que sa taille intrinsèque sous 768px (voir le
   * JSX plus bas) ; identité quand le canvas est affiché à sa taille
   * intrinsèque, donc sans effet à partir de 768px.
   */
  const clientDeltaToCanvas = (startX: number, startY: number, clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { dx: clientX - startX, dy: clientY - startY };
    const rect = canvas.getBoundingClientRect();
    const dx = pointerToCanvas(clientX, rect.left, rect.width, canvas.width)
      - pointerToCanvas(startX, rect.left, rect.width, canvas.width);
    const dy = pointerToCanvas(clientY, rect.top, rect.height, canvas.height)
      - pointerToCanvas(startY, rect.top, rect.height, canvas.height);
    return { dx, dy };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!drag.current) return;
    const { dx, dy } = clientDeltaToCanvas(drag.current.startX, drag.current.startY, e.clientX, e.clientY);
    setOffset({ x: drag.current.ox + dx, y: drag.current.oy + dy });
  }, []);
  const onMouseUp = useCallback(() => { drag.current = null; }, []);

  /* Touch */
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    lastTouch.current = { x: touch.clientX, y: touch.clientY };
    drag.current = { startX: touch.clientX, startY: touch.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (!drag.current) return;
    const touch = e.touches[0];
    lastTouch.current = { x: touch.clientX, y: touch.clientY };
    const { dx, dy } = clientDeltaToCanvas(drag.current.startX, drag.current.startY, touch.clientX, touch.clientY);
    setOffset({ x: drag.current.ox + dx, y: drag.current.oy + dy });
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

  /* ── Confirmer → rendre sur canvas OUTPUT×OUTPUT ─────────── */
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;

    const out    = document.createElement('canvas');
    out.width    = OUTPUT;
    out.height   = OUTPUT;
    const ctx    = out.getContext('2d');
    if (!ctx) return;

    const ratio  = OUTPUT / SIZE;
    const w      = img.naturalWidth  * scale * ratio;
    const h      = img.naturalHeight * scale * ratio;
    const ox     = offset.x * ratio;
    const oy     = offset.y * ratio;

    // clip circulaire
    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, ox - w / 2, oy - h / 2, w, h);

    out.toBlob(
      (blob) => { if (blob) onConfirm(blob); },
      'image/jpeg',
      0.92,
    );
  };

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex flex-col items-center gap-5 rounded-2xl bg-card p-6 shadow-2xl w-full max-w-sm">

        <h2 className="text-sm font-bold text-text">{t('title')}</h2>
        <p className="text-xs text-sub -mt-3">{t('hint')}</p>

        {/* Canvas — sous 768px l'affichage se réduit (max-md:*) mais la
            résolution interne (width/height) et donc le rendu exporté ne
            changent pas ; voir pointerToCanvas pour la conversion des
            coordonnées de pointeur que ce rétrécissement impose. */}
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="rounded-full cursor-grab active:cursor-grabbing select-none max-md:h-auto max-md:w-full max-md:max-w-80"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        />

        {/* Zoom slider */}
        <div className="w-full flex items-center gap-3">
          <i className="fa-solid fa-magnifying-glass-minus text-sub text-xs" />
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
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
            className="flex-1 rounded-full bg-gold py-2 text-sm font-bold text-white hover:bg-gold-dark transition-colors"
          >
            {t('confirm')}
          </button>
        </div>

      </div>
    </div>
  );
}
