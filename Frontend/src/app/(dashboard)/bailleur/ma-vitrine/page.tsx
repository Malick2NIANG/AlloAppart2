'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export default function MaVitrinePage() {
  const { getToken }  = useAuth();
  const router        = useRouter();
  const { toast }     = useToast();
  const toastRef      = useRef(toast);
  toastRef.current    = toast;

  const [user,      setUser]      = useState<User | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [checking,  setChecking]  = useState(false);
  const [slugAvail, setSlugAvail] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form
  const [agencyName,   setAgencyName]   = useState('');
  const [agencySlug,   setAgencySlug]   = useState('');
  const [bio,          setBio]          = useState('');
  const [phone,        setPhone]        = useState('');
  const [avatar,       setAvatar]       = useState('');

  const avatarRef  = useRef<HTMLInputElement>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const me = await api.get<User>('/auth/me', token);
      // Guard : réservé aux PRO_AGENCE
      if (!me.roles?.includes('PRO_AGENCE')) {
        router.replace('/bailleur');
        return;
      }
      setUser(me);
      setAgencyName(me.agencyName ?? '');
      setAgencySlug(me.agencySlug ?? '');
      setBio(me.bio ?? '');
      setPhone(me.phone ?? '');
      setAvatar(me.avatar ?? '');
      if (me.agencySlug) setSlugAvail(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [getToken, router]);

  useEffect(() => { void load(); }, [load]);

  // Vérification dispo slug en temps réel (debounce 500ms)
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug === user?.agencySlug) { setSlugAvail(slug ? true : null); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setSlugAvail(false); return; }
    setChecking(true);
    try {
      const token = await getToken().catch(() => null);
      if (!token) return;
      const res = await api.get<{ available: boolean }>(`/agences/check-slug?slug=${slug}`, token);
      setSlugAvail(res.available);
    } catch { setSlugAvail(null); }
    finally { setChecking(false); }
  }, [getToken, user?.agencySlug]);

  const handleSlugChange = (val: string) => {
    const clean = slugify(val);
    setAgencySlug(clean);
    setSlugAvail(null);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(() => void checkSlugAvailability(clean), 500);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = await getToken().catch(() => null);
    if (!token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json() as { url?: string };
      if (data.url) setAvatar(data.url);
    } catch { toastRef.current.error('Erreur upload logo'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (agencySlug && slugAvail === false) { toastRef.current.error('Ce slug n\'est pas disponible.'); return; }
    const token = await getToken().catch(() => null);
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.patch<User>('/auth/me', {
        agencyName: agencyName.trim() || undefined,
        agencySlug: agencySlug.trim() || undefined,
        bio:        bio.trim()        || undefined,
        phone:      phone.trim()      || undefined,
        avatar:     avatar            || undefined,
      }, token);
      setUser(updated);
      toastRef.current.success('Vitrine mise à jour !');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      toastRef.current.error(msg ?? 'Erreur lors de la sauvegarde.');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );

  const vitrinUrl = agencySlug ? `/agences/${agencySlug}` : null;
  const slugStatusIcon = checking
    ? 'fa-spinner fa-spin text-sub'
    : slugAvail === true  ? 'fa-circle-check text-emerald-500'
    : slugAvail === false ? 'fa-circle-xmark text-red-500'
    : '';

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-text flex items-center gap-2">
            <i className="fa-solid fa-store text-gold-dark" /> Ma vitrine
          </h1>
          <p className="text-sm text-sub mt-0.5">Personnalisez votre catalogue public et partagez-le avec vos clients.</p>
        </div>
        {vitrinUrl && (
          <Link href={vitrinUrl} target="_blank"
            className="inline-flex items-center gap-2 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white text-sm font-semibold px-4 py-2.5 transition-colors">
            <i className="fa-solid fa-arrow-up-right-from-square text-xs" /> Voir ma vitrine
          </Link>
        )}
      </div>

      {/* Aperçu lien */}
      {vitrinUrl && (
        <div className="rounded-2xl border border-gold/30 bg-gold-pale/40 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gold/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-link text-gold-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-sub uppercase tracking-wide">Lien public de votre vitrine</p>
            <p className="text-sm font-semibold text-gold-dark truncate">alloAppart.sn{vitrinUrl}</p>
          </div>
          <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(`https://alloAppart.sn${vitrinUrl}`); toastRef.current.success('Lien copié !'); }}
            className="h-8 w-8 rounded-lg bg-white/60 flex items-center justify-center text-sub hover:text-gold-dark hover:bg-white transition-colors shrink-0">
            <i className="fa-regular fa-copy text-sm" />
          </button>
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-5">

        {/* Logo / Avatar */}
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-xs font-bold text-sub uppercase tracking-wider mb-4">Logo de l&apos;agence</h2>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="Logo" className="h-20 w-20 rounded-2xl object-cover border border-line" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-gold-pale flex items-center justify-center text-2xl font-extrabold text-gold-dark border border-line">
                  {(agencyName || user?.agencyName || '?')[0]}
                </div>
              )}
              <button type="button" onClick={() => avatarRef.current?.click()} disabled={uploading}
                className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-xl bg-gold-dark text-white flex items-center justify-center hover:bg-gold-dark/90 transition-colors shadow-sm">
                {uploading ? <i className="fa-solid fa-spinner fa-spin text-[10px]" /> : <i className="fa-solid fa-camera text-[10px]" />}
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Photo ou logo de votre agence</p>
              <p className="text-xs text-sub mt-0.5">Format recommandé : carré, 400×400 px minimum.</p>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
        </div>

        {/* Identité */}
        <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
          <h2 className="text-xs font-bold text-sub uppercase tracking-wider">Identité de l&apos;agence</h2>

          <div>
            <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">Nom de l&apos;agence</label>
            <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Ex : Immobilier Dakar" maxLength={150}
              className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">
              Slug URL <span className="text-sub font-normal">(identifiant unique de votre vitrine)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sub text-sm select-none">alloAppart.sn/agences/</span>
              <input
                value={agencySlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="immobilier-dakar"
                maxLength={80}
                className="w-full rounded-xl border border-line bg-bg pl-[200px] pr-10 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              {slugStatusIcon && (
                <i className={`fa-solid ${slugStatusIcon} absolute right-3.5 top-1/2 -translate-y-1/2 text-sm`} />
              )}
            </div>
            {agencySlug && slugAvail === false && (
              <p className="text-[11px] text-red-500 mt-1">Ce slug est déjà utilisé. Essayez : {agencySlug}-{Math.floor(Math.random() * 99) + 1}</p>
            )}
            {agencySlug && slugAvail === true && (
              <p className="text-[11px] text-emerald-600 mt-1">Disponible !</p>
            )}
            <p className="text-[11px] text-sub mt-1">Minuscules, chiffres et tirets uniquement.</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 flex items-center justify-between">
              <span>Description / Bio</span>
              <span className={bio.length > 450 ? 'text-amber-500' : 'text-sub'}>{bio.length}/500</span>
            </label>
            <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500}
              placeholder="Présentez votre agence, vos spécialités, votre zone d'intervention…"
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">Téléphone public</label>
            <div className="relative">
              <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-xs" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
                placeholder="+221 77 000 00 00"
                className="w-full rounded-xl border border-line bg-bg pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving || (!!agencySlug && slugAvail === false)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3 disabled:opacity-50 transition-colors">
          {saving
            ? <><i className="fa-solid fa-spinner fa-spin" /> Enregistrement…</>
            : <><i className="fa-solid fa-floppy-disk text-sm" /> Enregistrer la vitrine</>}
        </button>
      </form>

    </div>
  );
}
