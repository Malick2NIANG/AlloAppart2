'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import AvatarCropper from '@/components/ui/AvatarCropper';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function ProfilPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const t = useTranslations('profil');

  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [phone,           setPhone]           = useState('');
  const [bio,             setBio]             = useState('');
  const [avatar,          setAvatar]          = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropSrc,         setCropSrc]         = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Charger les données Clerk + API au montage */
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhone(user.phoneNumbers?.[0]?.phoneNumber ?? '');

    getToken().then((token) => {
      if (!token) return;
      api.get<{ bio?: string | null; avatar?: string | null }>('/auth/me', token)
        .then((me) => {
          setBio(me.bio ?? '');
          setAvatar(me.avatar ?? '');
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      await Promise.all([
        user?.update({ firstName, lastName }),
        token
          ? fetch(`${API_URL}/auth/me`, {
              method:  'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body:    JSON.stringify({ firstName, lastName, phone: phone || null, bio: bio || null, avatar: avatar || null }),
            }).catch(() => null)
          : null,
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      window.dispatchEvent(new Event('aa-profile-updated'));
    } catch { /* ignore */ }
    finally { setSaving(false); }
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
            <i className="fa-solid fa-user-circle text-gold-dark" /> {t('personalInfo')}
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
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 000 00 00"
              disabled={!isLoaded}
              className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
            />
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
              type="submit" disabled={saving}
              className="btn-gold rounded-full px-6 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('saving')}</>
                : <><i className="fa-solid fa-floppy-disk" /> {t('save')}</>
              }
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
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
