'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import AvatarCropper from '@/components/ui/AvatarCropper';
import PhoneInput from '@/components/ui/PhoneInput';
import { useToast } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function ProfilPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const t = useTranslations('profil');
  const { toast } = useToast();

  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [phone,           setPhone]           = useState('');
  const [bio,             setBio]             = useState('');
  const [avatar,          setAvatar]          = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropSrc,         setCropSrc]         = useState<string | null>(null);

  // Instantané des valeurs chargées — sert à savoir si le formulaire a
  // réellement changé, pour désactiver "Enregistrer" tant que rien n'a bougé.
  const [initialValues, setInitialValues] = useState<{
    firstName: string; lastName: string; phone: string; bio: string; avatar: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Charger les données Clerk + API au montage */
  useEffect(() => {
    if (!user) return;
    const fn = user.firstName ?? '';
    const ln = user.lastName ?? '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- état synchronisé depuis l'objet user de Clerk
    setFirstName(fn);
    setLastName(ln);

    getToken().then((token) => {
      if (!token) { setInitialValues({ firstName: fn, lastName: ln, phone: '', bio: '', avatar: '' }); return; }
      // Le numéro (comme la bio et l'avatar) est sauvegardé côté backend via
      // PATCH /auth/me — pas dans Clerk — donc c'est là qu'il faut le relire,
      // pas dans user.phoneNumbers (qui reste vide, on ne l'alimente jamais).
      api.get<{ phone?: string | null; bio?: string | null; avatar?: string | null }>('/auth/me', token)
        .then((me) => {
          const ph = me.phone ?? '';
          const b  = me.bio ?? '';
          const av = me.avatar ?? '';
          setPhone(ph);
          setBio(b);
          setAvatar(av);
          setInitialValues({ firstName: fn, lastName: ln, phone: ph, bio: b, avatar: av });
        })
        .catch(() => setInitialValues({ firstName: fn, lastName: ln, phone: '', bio: '', avatar: '' }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isDirty = initialValues != null && (
    firstName !== initialValues.firstName ||
    lastName  !== initialValues.lastName  ||
    phone     !== initialValues.phone     ||
    bio       !== initialValues.bio       ||
    avatar    !== initialValues.avatar
  );

  if (!isSignedIn) {
    return (
      <main className="py-16 px-4 bg-bg min-h-screen">
        <div className="aa-container max-w-2xl text-center">
          <p className="text-sub text-sm">{t('signInRequired')}</p>
          <Link href="/sign-in" className="btn-gold mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
            {t('signIn')}
          </Link>
        </div>
      </main>
    );
  }

  const displayName  = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const displayEmail = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const initials     = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  /* ── Sélection → ouvre le cropper ── */
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCropSrc(URL.createObjectURL(file));
  };

  /* ── Après recadrage → upload ── */
  const handleCropConfirm = async (blob: Blob) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    const token = await getToken().catch(() => null);
    if (!token) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('file', blob, 'avatar.jpg');
      const res  = await fetch(`${API_URL}/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      const data = await res.json() as { url?: string };
      if (data.url) setAvatar(data.url);
    } catch { /* ignore */ }
    finally { setUploadingAvatar(false); }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  /* ── Sauvegarde ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken().catch(() => null);
      if (!token) throw new Error();

      const [, apiRes] = await Promise.all([
        user?.update({ firstName, lastName }),
        fetch(`${API_URL}/auth/me`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ firstName, lastName, phone: phone || null, bio: bio || null, avatar: avatar || null }),
        }),
      ]);

      if (!apiRes.ok) {
        // 409 = numéro déjà utilisé par un autre compte (cf. auth.service.ts
        // updateMe) — on affiche le message renvoyé par le backend plutôt
        // qu'un message générique.
        const body = await apiRes.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? undefined);
      }

      setInitialValues({ firstName, lastName, phone, bio, avatar });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      window.dispatchEvent(new Event('aa-profile-updated'));
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : t('saveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      {cropSrc && (
        <AvatarCropper src={cropSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}

      <div className="aa-container max-w-2xl">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/bailleur" className="hover:text-gold-dark transition-colors">{t('mySpace')}</Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('title')}</span>
        </nav>

        {/* Header — avatar */}
        <div className="mb-8 flex items-center gap-5">
          <div className="relative group shrink-0">
            {avatar ? (
              <div className="relative h-20 w-20 rounded-full overflow-hidden ring-4 ring-gold/20">
                <Image src={avatar} alt="Photo de profil" fill className="object-cover" />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-pale text-2xl font-extrabold text-gold-dark ring-4 ring-gold/20">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {uploadingAvatar
                ? <i className="fa-solid fa-spinner fa-spin text-white text-sm" />
                : <i className="fa-solid fa-camera text-white text-sm" />
              }
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-text">{displayName || t('title')}</h1>
            <p className="text-sm text-sub">{displayEmail}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 text-xs text-gold-dark hover:underline"
            >
              <i className="fa-solid fa-camera text-[10px] mr-1" />
              {avatar ? t('changePhoto') : t('addPhoto')}
            </button>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSave} className="rounded-2xl border border-line bg-card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-circle-user text-gold-dark" /> {t('personalInfo')}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('firstName')}>
              <input
                type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                disabled={!isLoaded}
                className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </Field>
            <Field label={t('lastName')}>
              <input
                type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                disabled={!isLoaded}
                className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </Field>
          </div>

          <Field label={t('email')}>
            <input
              type="email" value={displayEmail} readOnly
              className="input-field opacity-60 cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-sub">{t('emailNote')}</p>
          </Field>

          <Field label={t('phone')}>
            <PhoneInput value={phone} onChange={setPhone} disabled={!isLoaded} />
          </Field>

          <Field label="Biographie">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t('bioPlaceholder')}
              className="input-field resize-none"
            />
            <p className="mt-1 text-right text-[11px] text-sub">{bio.length}/500</p>
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit" disabled={saving || !isDirty}
              className="btn-gold rounded-full px-6 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('saving')}</>
                : <><i className="fa-solid fa-floppy-disk" /> {t('save')}</>
              }
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <i className="fa-solid fa-circle-check" /> {t('saved')}
              </span>
            )}
          </div>
        </form>

        {/* Lien sécurité */}
        <Link
          href="/profil/securite"
          className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-card px-5 py-4 hover:border-gold/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-shield-halved text-gold-dark" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{t('securityTitle')}</p>
              <p className="text-xs text-sub">{t('securityDesc')}</p>
            </div>
          </div>
          <i className="fa-solid fa-chevron-right text-sub text-xs group-hover:text-gold-dark transition-colors" />
        </Link>

      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-sub uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
