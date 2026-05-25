'use client';

import { useState, useRef, DragEvent } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

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
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function syncUrls(items: UploadItem[], onChange: (imgs: string[]) => void) {
  onChange(items.filter((it) => it.status === 'done').map((it) => it.url));
}

export default function ImageUploadZone({ images, onChange, getToken }: Props) {
  const [items, setItems] = useState<UploadItem[]>(
    () => images.map((url) => ({ id: genId(), url, status: 'done' as const, name: url.split('/').pop() ?? 'photo' }))
  );
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);

    // Client-side size validation
    const oversized = fileArr.some((f) => f.size > MAX_SIZE);
    if (oversized) {
      setSizeError(true);
      setTimeout(() => setSizeError(false), 4000);
      return;
    }
    setSizeError(false);

    const token = await getToken();

    // Assign a stable ID to each upload slot before the async work starts
    const pending: UploadItem[] = fileArr.map((f) => ({
      id: genId(), url: '', status: 'uploading' as const, name: f.name,
    }));

    setItems((prev) => {
      const next = [...prev, ...pending];
      syncUrls(next, onChange);
      return next;
    });

    // Upload each file independently; update its slot by ID when done
    await Promise.all(
      fileArr.map(async (file, i) => {
        const itemId = pending[i].id;
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
      })
    );
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
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
          <p className="text-sm font-semibold text-text">Glissez vos photos ici</p>
          <p className="text-xs text-sub mt-0.5">ou <span className="text-gold-dark underline">cliquez pour parcourir</span></p>
        </div>
        <p className="text-[11px] text-sub">JPG, PNG, WEBP — 8 Mo max par photo</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {sizeError && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <i className="fa-solid fa-circle-exclamation" /> Une ou plusieurs photos dépassent 8 Mo.
        </p>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item, idx) => (
            <div key={item.id} className="group relative aspect-4/3 overflow-hidden rounded-xl border border-line bg-bg">
              {item.status === 'uploading' ? (
                <div className="flex h-full items-center justify-center">
                  <i className="fa-solid fa-spinner fa-spin text-gold-dark" />
                </div>
              ) : item.status === 'error' ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                  <i className="fa-solid fa-circle-exclamation text-red-400" />
                  <p className="text-[10px] text-red-500 truncate w-full">{item.name}</p>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
              {idx === 0 && item.status === 'done' && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold text-gray-900">
                  Principale
                </span>
              )}
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
          {items.filter((i) => i.status === 'done').length} photo(s) · La première sera la photo principale
        </p>
      )}
    </div>
  );
}
