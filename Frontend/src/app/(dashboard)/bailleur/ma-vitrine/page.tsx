'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { AGENCY_COLORS, getAgencyColorOption } from '@/lib/agencyColors';
import type { User, Subscription, Listing, PaginatedResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function MaVitrinePage() {
  const { getToken }  = useAuth();
  const router        = useRouter();
  const { toast }     = useToast();
  const t             = useTranslations('bailleur');
  const toastRef      = useRef(toast);
  toastRef.current    = toast;

  const [user,         setUser]         = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [activeCount,  setActiveCount]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [uploading,    setUploading]    = useState(false);

  // Form — le slug (agencySlug) n'apparaît jamais ici : il est assigné
  // automatiquement côté serveur (cf. AuthService.generateUniqueAgencySlug),
  // "Ma vitrine" reste une page AlloAppart, pas un nom de domaine à gérer.
  const [agencyName,    setAgencyName]    = useState('');
  const [bio,           setBio]           = useState('');
  const [phone,         setPhone]         = useState('');
  const [avatar,        setAvatar]        = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyColor,   setAgencyColor]   = useState('gold');

  const avatarRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const me = await api.get<User>('/auth/me', token);
      if (!me.roles?.includes('PRO_AGENCE')) {
        router.replace('/bailleur');
        return;
      }
      setUser(me);
      setAgencyName(me.agencyName ?? '');
      // Repli sur les champs perso (bio/phone/avatar) tant que la vitrine n'a
      // pas encore ses propres valeurs — évite qu'un formulaire vide semble
      // effacer ce qui s'affiche déjà publiquement (cf. agencesService
      // .resolveVitrineFields côté back, même logique de repli).
      setBio(me.agencyBio ?? me.bio ?? '');
      setPhone(me.agencyPhone ?? me.phone ?? '');
      setAvatar(me.agencyAvatar ?? me.avatar ?? '');
      setAgencyAddress(me.agencyAddress ?? '');
      setAgencyColor(me.agencyColor ?? 'gold');

      // Aperçu fidèle à /agences/:slug : badge PRO + nombre d'annonces actives.
      const [sub, mine] = await Promise.all([
        api.get<Subscription>('/subscriptions/me', token).catch(() => null),
        api.get<PaginatedResponse<Listing>>('/listings/mine', token).catch(() => null),
      ]);
      setSubscription(sub);
      setActiveCount(mine?.data.filter((l) => l.status === 'ACTIVE').length ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [getToken, router]);

  useEffect(() => { void load(); }, [load]);

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
    } catch { toastRef.current.error(t('vitrineUploadError')); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken().catch(() => null);
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.patch<User>('/auth/me', {
        agencyName:    agencyName.trim()    || undefined,
        agencyBio:     bio.trim()           || undefined,
        agencyPhone:   phone.trim()         || undefined,
        agencyAvatar:  avatar               || undefined,
        agencyAddress: agencyAddress.trim() || undefined,
        agencyColor,
      }, token);
      setUser(updated);
      toastRef.current.success(t('vitrineSaved'));
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      toastRef.current.error(msg ?? t('vitrineSaveError'));
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );

  const vitrinUrl     = user?.agencySlug ? `/agences/${user.agencySlug}` : null;
  const color         = getAgencyColorOption(agencyColor);
  const previewName   = agencyName || user?.agencyName || t('vitrinePreviewFallbackName');
  const premium       = subscription?.plan === 'PRO' && subscription?.status === 'ACTIVE';
  const listingsCount = activeCount;

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-text flex items-center gap-2">
            <i className="fa-solid fa-store text-gold-dark" /> {t('vitrineTitle')}
          </h1>
          <p className="text-sm text-sub mt-0.5">{t('vitrineSubtitle')}</p>
        </div>
        {vitrinUrl && (
          <Link href={vitrinUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white text-sm font-semibold px-4 py-2.5 transition-colors">
            <i className="fa-solid fa-eye text-xs" /> {t('vitrineSeeLink')}
          </Link>
        )}
      </div>

      {/* Lien public — lecture seule, jamais éditable (assigné automatiquement) */}
      {vitrinUrl && (
        <div className="rounded-2xl border border-gold/30 bg-gold-pale/40 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gold/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-link text-gold-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-sub uppercase tracking-wide">{t('vitrineLinkLabel')}</p>
            <p className="text-sm font-semibold text-gold-dark truncate">alloAppart.sn{vitrinUrl}</p>
          </div>
          <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(`https://alloAppart.sn${vitrinUrl}`); toastRef.current.success(t('vitrineLinkCopied')); }}
            className="h-8 w-8 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center text-sub hover:text-gold-dark hover:bg-white dark:hover:bg-white/20 transition-colors shrink-0">
            <i className="fa-regular fa-copy text-sm" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">

        <form onSubmit={(e) => void handleSave(e)} className="space-y-5">

          {/* Logo / Avatar */}
          <div className="rounded-2xl border border-line bg-card p-5">
            <h2 className="text-xs font-bold text-sub uppercase tracking-wider mb-4">{t('vitrineLogo')}</h2>
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
                <p className="text-sm font-semibold text-text">{t('vitrineLogoHint')}</p>
                <p className="text-xs text-sub mt-0.5">{t('vitrineLogoDesc')}</p>
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          {/* Couleur d'accent */}
          <div className="rounded-2xl border border-line bg-card p-5">
            <h2 className="text-xs font-bold text-sub uppercase tracking-wider mb-1">{t('vitrineColorLabel')}</h2>
            <p className="text-xs text-sub mb-4">{t('vitrineColorDesc')}</p>
            <div className="flex flex-wrap gap-3">
              {AGENCY_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setAgencyColor(c.key)}
                  title={c.label}
                  aria-label={c.label}
                  className="h-10 w-10 rounded-full flex items-center justify-center transition-transform"
                  style={{
                    backgroundColor: c.hex,
                    outline: agencyColor === c.key ? `2px solid ${c.hex}` : 'none',
                    outlineOffset: '2px',
                    transform: agencyColor === c.key ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {agencyColor === c.key && <i className="fa-solid fa-check text-white text-sm" />}
                </button>
              ))}
            </div>
          </div>

          {/* Identity */}
          <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
            <h2 className="text-xs font-bold text-sub uppercase tracking-wider">{t('vitrineIdentity')}</h2>

            <div>
              <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">{t('vitrineAgencyName')}</label>
              <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)}
                placeholder={t('vitrineAgencyNamePh')} maxLength={150}
                className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
            </div>

            <div>
              <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>{t('vitrineBioLabel')}</span>
                <span className={bio.length > 450 ? 'text-amber-500' : 'text-sub'}>{bio.length}/500</span>
              </label>
              <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500}
                placeholder={t('fieldDescPh')}
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none" />
            </div>

            <div>
              <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">{t('vitrinePhone')}</label>
              <div className="relative">
                <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-xs" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
                  placeholder="+221 77 000 00 00"
                  className="w-full rounded-xl border border-line bg-bg pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">{t('vitrineAddressLabel')}</label>
              <div className="relative">
                <i className="fa-solid fa-location-dot absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-xs" />
                <input value={agencyAddress} onChange={(e) => setAgencyAddress(e.target.value)} maxLength={200}
                  placeholder={t('vitrineAddressPh')}
                  className="w-full rounded-xl border border-line bg-bg pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3 disabled:opacity-50 transition-colors">
            {saving
              ? <><i className="fa-solid fa-spinner fa-spin" /> {t('vitrineSaving')}</>
              : <><i className="fa-solid fa-floppy-disk text-sm" /> {t('vitrineSave')}</>}
          </button>
        </form>

        {/* Live preview — ce que le client verra sur /agences/:slug */}
        <div className="lg:sticky lg:top-6">
          <p className="text-xs font-bold text-sub uppercase tracking-wider mb-2">{t('vitrinePreviewLabel')}</p>
          <div className="rounded-2xl border border-line overflow-hidden shadow-sm">
            <div
              className="relative overflow-hidden px-5 py-8"
              style={{ background: `linear-gradient(to bottom right, #1a1200, #2d1f00)` }}
            >
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-40 h-40 rounded-full blur-3xl" style={{ backgroundColor: color.hex }} />
                <div className="absolute bottom-0 right-1/4 w-28 h-28 rounded-full blur-3xl" style={{ backgroundColor: color.hex }} />
              </div>
              <div className="relative flex flex-col items-center text-center gap-3">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={previewName}
                    className="h-16 w-16 rounded-2xl object-cover shadow-lg"
                    style={{ boxShadow: `0 0 0 3px ${color.hex}55` }} />
                ) : (
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-extrabold"
                    style={{ backgroundColor: `${color.hex}33`, color: color.hex, boxShadow: `0 0 0 3px ${color.hex}55` }}>
                    {previewName[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 justify-center flex-wrap">
                    <h3 className="text-base font-extrabold text-white">{previewName}</h3>
                    {premium && (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${color.hex}33`, borderColor: `${color.hex}66`, borderWidth: 1, color: color.hex }}>
                        <i className="fa-solid fa-crown text-[8px]" /> {t('vitrinePreviewProBadge')}
                      </span>
                    )}
                  </div>
                  {bio && <p className="text-gray-300 text-[11px] mt-1.5 max-w-[240px] line-clamp-2">{bio}</p>}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-building text-[10px]" style={{ color: color.hex }} />
                    <span className="font-semibold text-white">{listingsCount}</span> {t(listingsCount > 1 ? 'vitrinePreviewListingsPlural' : 'vitrinePreviewListingsSingular')}
                  </span>
                  {agencyAddress && (
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-location-dot text-[10px]" style={{ color: color.hex }} />
                      {agencyAddress}
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-phone text-[10px]" style={{ color: color.hex }} />
                      {phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-card px-4 py-3 flex items-center justify-center gap-2 border-t border-line">
              <i className="fa-solid fa-grip text-sub text-xs" />
              <p className="text-xs text-sub">{t('vitrinePreviewCatalogueNote')}</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
