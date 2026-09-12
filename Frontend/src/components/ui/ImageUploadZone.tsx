'use client';

import { useState, useRef, DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import PhotoCropper from './PhotoCropper';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const MAX_IMG_SIZE   = 8   * 1024 * 1024; // 8 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const isVideoFile  = (f: File)   => VIDEO_TYPES.includes(f.type);
const isVideoUrl   = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

interface UploadItem {
  id: string;
  url: string;
  status: 'done' | 'uploading' | 'error';
  name: string;
}

interface Props {
  images: string[];
  onChange: (imgs: string[]) => void;
  getToken: () => Promise<string | null>;
  // Recadrage 4:3 à l'ajout + action "Ajuster" a posteriori. Activé par
  // défaut (photos d'annonce) ; désactivé explicitement pour les usages où
  // rogner l'image serait indésirable (ex. preuves jointes à un litige).
  enableCrop?: boolean;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Redimensionne/compresse une image côté client avant upload, utilisé
// seulement quand enableCrop=false (le recadrage produit déjà une image de
// taille/qualité maîtrisée, donc ce passage est inutile sur ce chemin-là).
async function compressImage(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function syncUrls(items: UploadItem[], onChange: (imgs: string[]) => void) {
  onChange(items.filter((it) => it.status === 'done').map((it) => it.url));
}

export default function ImageUploadZone({ images, onChange, getToken, enableCrop = true }: Props) {
  const t = useTranslations('upload');
  const [items, setItems] = useState<UploadItem[]>(
    () => images.map((url) => ({ id: genId(), url, status: 'done' as const, name: url.split('/').pop() ?? 'photo' }))
  );
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [adjustError, setAdjustError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // File d'attente de recadrage : chaque photo (pas vidéo) fraîchement
  // sélectionnée/déposée passe par PhotoCropper avant d'être compressée et
  // envoyée — un seul cadre affiché à la fois, les suivants s'enchaînent.
  const [cropQueue, setCropQueue] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  // Cible d'un recadrage a posteriori ("Ajuster") sur une photo déjà uploadée.
  const [adjustTarget, setAdjustTarget] = useState<{ id: string; url: string; oldUrl: string } | null>(null);

  // Envoie un fichier déjà prêt (compressé ou issu d'un recadrage) vers l'API
  // et met à jour le slot correspondant par son ID.
  const uploadOne = async (file: File, itemId: string) => {
    const token = await getToken();
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json() as { url: string };
      setItems((prev) => {
        const next = prev.map((it) => it.id === itemId ? { ...it, url, status: 'done' as const } : it);
        syncUrls(next, onChange);
        return next;
      });
    } catch {
      setItems((prev) => {
        const next = prev.map((it) => it.id === itemId ? { ...it, status: 'error' as const } : it);
        syncUrls(next, onChange);
        return next;
      });
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);

    // Client-side size validation
    const oversized = fileArr.some((f) =>
      isVideoFile(f) ? f.size > MAX_VIDEO_SIZE : f.size > MAX_IMG_SIZE
    );
    if (oversized) {
      setSizeError(true);
      setTimeout(() => setSizeError(false), 4000);
      return;
    }
    setSizeError(false);

    // Assign a stable ID to each upload slot before the async work starts
    const pending: UploadItem[] = fileArr.map((f) => ({
      id: genId(), url: '', status: 'uploading' as const, name: f.name,
    }));

    setItems((prev) => {
      const next = [...prev, ...pending];
      syncUrls(next, onChange);
      return next;
    });

    // Vidéos : jamais de recadrage, upload direct.
    const videoUploads = fileArr
      .map((file, i) => ({ file, itemId: pending[i].id }))
      .filter(({ file }) => isVideoFile(file));

    const photos = fileArr
      .map((file, i) => ({ file, itemId: pending[i].id }))
      .filter(({ file }) => !isVideoFile(file));

    if (enableCrop) {
      // Photos d'annonce : mises en file pour passer par PhotoCropper une à une.
      const photoAdds = photos.map(({ file, itemId }) => ({ id: itemId, file, previewUrl: URL.createObjectURL(file) }));
      if (photoAdds.length) setCropQueue((prev) => [...prev, ...photoAdds]);
    } else {
      // Autres usages (ex. preuves de litige) : pas de recadrage, upload direct après compression.
      await Promise.all(photos.map(async ({ file, itemId }) => uploadOne(await compressImage(file), itemId)));
    }

    await Promise.all(videoUploads.map(({ file, itemId }) => uploadOne(file, itemId)));
  };

  const currentCrop = cropQueue[0];

  const handleCropConfirm = async (blob: Blob) => {
    if (!currentCrop) return;
    const { id, file, previewUrl } = currentCrop;
    URL.revokeObjectURL(previewUrl);
    setCropQueue((prev) => prev.slice(1));
    const cropped = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
    await uploadOne(cropped, id);
  };

  const handleCropCancel = () => {
    if (!currentCrop) return;
    URL.revokeObjectURL(currentCrop.previewUrl);
    setCropQueue((prev) => prev.slice(1));
    remove(currentCrop.id);
  };

  const openAdjust = (item: UploadItem) => {
    if (item.status !== 'done' || isVideoUrl(item.url)) return;
    setAdjustTarget({ id: item.id, url: item.url, oldUrl: item.url });
  };

  const handleAdjustConfirm = async (blob: Blob) => {
    if (!adjustTarget) return;
    const { id, oldUrl } = adjustTarget;
    setAdjustTarget(null);
    setItems((prev) => {
      const next = prev.map((it) => it.id === id ? { ...it, status: 'uploading' as const } : it);
      syncUrls(next, onChange);
      return next;
    });
    const token = await getToken();
    const fd = new FormData();
    fd.append('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json() as { url: string };
      setItems((prev) => {
        const next = prev.map((it) => it.id === id ? { ...it, url, status: 'done' as const } : it);
        syncUrls(next, onChange);
        return next;
      });
    } catch {
      // On garde la photo d'origine plutôt que de la marquer en erreur.
      setItems((prev) => {
        const next = prev.map((it) => it.id === id ? { ...it, url: oldUrl, status: 'done' as const } : it);
        syncUrls(next, onChange);
        return next;
      });
      setAdjustError(true);
      setTimeout(() => setAdjustError(false), 4000);
    }
  };

  const handleAdjustCancel = () => setAdjustTarget(null);

  // Une image locale (objet URL) ne peut pas échouer par CORS ; une image
  // distante déjà uploadée (Cloudinary) le pourrait en théorie — filet de
  // sécurité pour ne jamais planter silencieusement.
  const handleAdjustLoadError = () => {
    setAdjustTarget(null);
    setAdjustError(true);
    setTimeout(() => setAdjustError(false), 4000);
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      syncUrls(next, onChange);
      return next;
    });
  };

  const setPrimary = (id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      syncUrls(next, onChange);
      return next;
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-all ${
          dragging ? 'border-gold bg-gold-pale' : 'border-line hover:border-gold/50 hover:bg-gold-pale/30'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
          <i className="fa-solid fa-cloud-arrow-up text-2xl text-gold-dark" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-text">{t('dropHere')}</p>
          <p className="text-xs text-sub mt-0.5">{t('or')} <span className="text-gold-dark underline">{t('browse')}</span></p>
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-[11px] text-sub">{t('photoLimits')}</p>
          <p className="text-[11px] text-sub">{t('videoLimits')}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {sizeError && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <i className="fa-solid fa-circle-exclamation" /> {t('fileTooLarge')}
        </p>
      )}

      {adjustError && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <i className="fa-solid fa-circle-exclamation" /> {t('adjustUploadError')}
        </p>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item, idx) => (
            <div key={item.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-bg">
              {item.status === 'uploading' ? (
                <div className="flex h-full items-center justify-center">
                  <i className="fa-solid fa-spinner fa-spin text-gold-dark" />
                </div>
              ) : item.status === 'error' ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                  <i className="fa-solid fa-circle-exclamation text-red-400" />
                  <p className="text-[10px] text-red-500 truncate w-full">{item.name}</p>
                </div>
              ) : isVideoUrl(item.url) ? (
                <div className="relative h-full w-full bg-gray-900">
                  <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60">
                      <i className="fa-solid fa-play text-white text-xs ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}

              {/* Badge principale */}
              {idx === 0 && item.status === 'done' && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold text-gray-900">
                  {t('primary')}
                </span>
              )}

              {/* Bouton "Définir comme principale" — visible au hover sur les autres photos */}
              {idx > 0 && item.status === 'done' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPrimary(item.id); }}
                  className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white opacity-0 transition group-hover:opacity-100 hover:bg-gold hover:text-gray-900"
                >
                  <i className="fa-solid fa-star text-[8px] mr-1" />{t('primary')}
                </button>
              )}

              {/* Bouton "Ajuster" — recadrer a posteriori une photo déjà envoyée */}
              {enableCrop && item.status === 'done' && !isVideoUrl(item.url) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openAdjust(item); }}
                  className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white opacity-0 transition group-hover:opacity-100 hover:bg-gold hover:text-gray-900"
                >
                  <i className="fa-solid fa-crop-simple text-[8px] mr-1" />{t('adjustLabel')}
                </button>
              )}

              {/* Bouton supprimer */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-500"
              >
                <i className="fa-solid fa-xmark text-[9px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-[11px] text-sub">
          {t('photoCount', { count: items.filter((i) => i.status === 'done' && !isVideoUrl(i.url)).length })}
          {items.some((i) => i.status === 'done' && isVideoUrl(i.url)) && ` · ${t('videoSuffix')}`}
          {' '}· {t('firstIsPrimary')}
        </p>
      )}

      {/* Recadrage à l'ajout — une photo à la fois, la file s'enchaîne */}
      {currentCrop && (
        <PhotoCropper
          key={currentCrop.id}
          src={currentCrop.previewUrl}
          onConfirm={(blob) => void handleCropConfirm(blob)}
          onCancel={handleCropCancel}
          onError={handleCropCancel}
        />
      )}

      {/* Recadrage a posteriori ("Ajuster") sur une photo déjà envoyée */}
      {adjustTarget && (
        <PhotoCropper
          key={adjustTarget.id}
          src={adjustTarget.url}
          onConfirm={(blob) => void handleAdjustConfirm(blob)}
          onCancel={handleAdjustCancel}
          onError={handleAdjustLoadError}
        />
      )}
    </div>
  );
}
