'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type DemoRole = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

export default function SecuritePage() {
  const { isSignedIn } = useAuth();
  const { user, isLoaded } = useUser();
  const t = useTranslations('securite');

  const [demoRole, setDemoRole] = useState<DemoRole>('visitor');
  const [mounted, setMounted]   = useState(false);

  /* Password form */
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [pwdSaving,   setPwdSaving]   = useState(false);
  const [pwdFlash,    setPwdFlash]    = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  /* 2FA */
  const [totpUri,     setTotpUri]     = useState<string | null>(null);
  const [totpCode,    setTotpCode]    = useState('');
  const [totpSaving,  setTotpSaving]  = useState(false);
  const [totpFlash,   setTotpFlash]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('aa_demo_role') as DemoRole | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration on mount
    if (stored && ['visitor', 'locataire', 'bailleur', 'dual', 'admin', 'agent'].includes(stored)) setDemoRole(stored);
    setMounted(true);
    const handler = (e: Event) => setDemoRole((e as CustomEvent<DemoRole>).detail);
    window.addEventListener('aa-demo-change', handler);
    return () => window.removeEventListener('aa-demo-change', handler);
  }, []);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 2FA state synced from user object
      setTotpEnabled(user.twoFactorEnabled ?? false);
    }
  }, [user]);

  if (!mounted) return null;

  const effectiveSignedIn = isSignedIn || demoRole !== 'visitor';
  const isDemo = !isSignedIn && demoRole !== 'visitor';

  if (!effectiveSignedIn) {
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
    if (isDemo) return;
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

  /* ── TOTP setup ── */
  const startTotp = async () => {
    if (!user || isDemo) return;
    setTotpSaving(true);
    try {
      const totp = await user.createTOTP();
      setTotpUri(totp.uri ?? null);
    } catch {
      setTotpFlash({ type: 'err', msg: t('totpError') });
    } finally {
      setTotpSaving(false);
    }
  };

  const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isDemo) return;
    setTotpSaving(true);
    try {
      await user.verifyTOTP({ code: totpCode });
      setTotpEnabled(true);
      setTotpUri(null);
      setTotpCode('');
      setTotpFlash({ type: 'ok', msg: t('totpSuccess') });
    } catch {
      setTotpFlash({ type: 'err', msg: t('totpInvalid') });
    } finally {
      setTotpSaving(false);
      setTimeout(() => setTotpFlash(null), 4000);
    }
  };

  const disableTotp = async () => {
    if (!user || isDemo) return;
    try {
      const factor = user.totpEnabled ? user.twoFactorEnabled : null;
      if (factor) await user.disableTOTP();
      setTotpEnabled(false);
      setTotpFlash({ type: 'ok', msg: t('totpDisabled') });
    } catch {
      setTotpFlash({ type: 'err', msg: t('totpError') });
    } finally {
      setTimeout(() => setTotpFlash(null), 4000);
    }
  };

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-2xl space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-sub">
          <Link href="/espace"  className="hover:text-gold-dark transition-colors">{t('mySpace')}</Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <Link href="/profil"  className="hover:text-gold-dark transition-colors">{t('profile')}</Link>
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

          {isDemo ? (
            <DemoBanner t={t} />
          ) : (
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

              <button type="submit" disabled={pwdSaving || !isLoaded}
                className="btn-gold rounded-full px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                {pwdSaving
                  ? <><i className="fa-solid fa-spinner fa-spin" /> {t('saving')}</>
                  : <><i className="fa-solid fa-floppy-disk" /> {t('pwdSave')}</>
                }
              </button>
            </form>
          )}
        </section>

        {/* ── Double authentification ── */}
        <section className="rounded-2xl border border-line bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text flex items-center gap-2">
                <i className="fa-solid fa-mobile-screen text-gold-dark text-xs" /> {t('totpTitle')}
              </h2>
              <p className="mt-1 text-xs text-sub max-w-sm">{t('totpDesc')}</p>
            </div>
            <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
              totpEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${totpEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {totpEnabled ? t('active') : t('inactive')}
            </span>
          </div>

          {isDemo ? (
            <DemoBanner t={t} />
          ) : totpEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <i className="fa-solid fa-shield-check" />
                <span>{t('totpActiveDesc')}</span>
              </div>
              {totpFlash && <Flash flash={totpFlash} />}
              <button onClick={disableTotp}
                className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                {t('totpDisable')}
              </button>
            </div>
          ) : totpUri ? (
            <div className="space-y-4">
              <p className="text-xs text-sub">{t('totpScan')}</p>
              {/* QR code via Google Charts API */}
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- external QR API, next/image requires configured domains */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                  alt="QR code 2FA"
                  className="rounded-xl border border-line"
                  width={180} height={180}
                />
              </div>
              <form onSubmit={verifyTotp} className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sub uppercase tracking-wide">{t('totpCode')}</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456" required
                    className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-center text-xl font-bold tracking-[0.5em] text-text outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition"
                  />
                </div>
                {totpFlash && <Flash flash={totpFlash} />}
                <button type="submit" disabled={totpSaving || totpCode.length < 6}
                  className="btn-gold rounded-full px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                  {totpSaving
                    ? <><i className="fa-solid fa-spinner fa-spin" /> {t('verifying')}</>
                    : <><i className="fa-solid fa-check" /> {t('verify')}</>
                  }
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-sub">{t('totpInactiveDesc')}</p>
              {totpFlash && <Flash flash={totpFlash} />}
              <button onClick={startTotp} disabled={totpSaving || !isLoaded}
                className="btn-gold rounded-full px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                {totpSaving
                  ? <><i className="fa-solid fa-spinner fa-spin" /> {t('loading')}</>
                  : <><i className="fa-solid fa-mobile-screen" /> {t('totpEnable')}</>
                }
              </button>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

/* ── Sub-components ── */

function DemoBanner({ t }: { t: ReturnType<typeof useTranslations<'securite'>> }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      <i className="fa-solid fa-flask shrink-0" />
      {t('demoReadOnly')}
    </div>
  );
}

function Flash({ flash }: { flash: { type: 'ok' | 'err'; msg: string } }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
      flash.type === 'ok'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border border-red-200 bg-red-50 text-red-700'
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
