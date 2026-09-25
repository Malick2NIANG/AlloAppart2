'use client';

import { useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function SecuritePage() {
  const { isSignedIn } = useAuth();
  const { user, isLoaded } = useUser();
  const t = useTranslations('securite');

  /* Password form */
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [pwdSaving,   setPwdSaving]   = useState(false);
  const [pwdFlash,    setPwdFlash]    = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  // Les 3 champs partent toujours vides (jamais pré-remplis) — "modifié"
  // signifie donc simplement que l'un d'eux a été saisi.
  const pwdDirty = currentPwd !== '' || newPwd !== '' || confirmPwd !== '';

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

  /* ── Password save ── */
  const handlePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdFlash({ type: 'err', msg: t('pwdMismatch') });
      return;
    }
    if (newPwd.length < 8) {
      setPwdFlash({ type: 'err', msg: t('pwdTooShort') });
      return;
    }
    setPwdSaving(true);
    try {
      await user?.updatePassword({ currentPassword: currentPwd, newPassword: newPwd });
      setPwdFlash({ type: 'ok', msg: t('pwdSuccess') });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? t('pwdError');
      setPwdFlash({ type: 'err', msg });
    } finally {
      setPwdSaving(false);
      setTimeout(() => setPwdFlash(null), 4000);
    }
  };

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-2xl space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-sub">
          <Link href="/profil" className="hover:text-gold-dark transition-colors">{t('profile')}</Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('title')}</span>
        </nav>

        <h1 className="text-xl font-extrabold text-text flex items-center gap-2">
          <i className="fa-solid fa-shield-halved text-gold-dark" /> {t('title')}
        </h1>

        {/* ── Mot de passe ── */}
        <section className="rounded-2xl border border-line bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-lock text-gold-dark text-xs" /> {t('pwdTitle')}
          </h2>

          <form onSubmit={handlePwd} className="space-y-3">
              <PwdField
                label={t('currentPwd')} value={currentPwd} show={showCurrent}
                onChange={setCurrentPwd} onToggle={() => setShowCurrent(!showCurrent)}
              />
              <PwdField
                label={t('newPwd')} value={newPwd} show={showNew}
                onChange={setNewPwd} onToggle={() => setShowNew(!showNew)}
              />
              <PwdField
                label={t('confirmPwd')} value={confirmPwd} show={showNew}
                onChange={setConfirmPwd} onToggle={() => setShowNew(!showNew)}
                error={confirmPwd.length > 0 && newPwd !== confirmPwd}
              />

              {pwdFlash && <Flash flash={pwdFlash} />}

              <button type="submit" disabled={pwdSaving || !isLoaded || !pwdDirty}
                className="btn-gold rounded-full px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                {pwdSaving
                  ? <><i className="fa-solid fa-spinner fa-spin" /> {t('saving')}</>
                  : <><i className="fa-solid fa-floppy-disk" /> {t('pwdSave')}</>
                }
              </button>
            </form>
        </section>

      </div>
    </main>
  );
}

/* ── Sub-components ── */

function Flash({ flash }: { flash: { type: 'ok' | 'err'; msg: string } }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
      flash.type === 'ok'
        ? 'border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
        : 'border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
    }`}>
      <i className={`fa-solid ${flash.type === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation'} shrink-0`} />
      {flash.msg}
    </div>
  );
}

function PwdField({ label, value, show, onChange, onToggle, error = false }: {
  label: string; value: string; show: boolean;
  onChange: (v: string) => void; onToggle: () => void; error?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-sub uppercase tracking-wide">{label}</label>
      <div className="relative">
        <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
        <input
          type={show ? 'text' : 'password'} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••" required
          className={`w-full rounded-xl border py-2.5 pl-10 pr-11 text-sm text-text placeholder:text-sub outline-none transition bg-bg ${
            error ? 'border-red-400 focus:ring-1 focus:ring-red-400/40' : 'border-line focus:border-gold focus:ring-1 focus:ring-gold/40'
          }`}
        />
        <button type="button" onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text transition">
          <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
        </button>
      </div>
    </div>
  );
}
