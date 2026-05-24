'use client';

import { useState, useEffect } from 'react';
import { useSignUp } from '@clerk/nextjs/legacy';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

type View = 'register' | 'verify';
interface Flash { type: 'error' | 'success'; message: string; }

const slide = {
  enter:  { x: 20, opacity: 0 },
  center: { x: 0,  opacity: 1 },
  exit:   { x: -20, opacity: 0 },
};

export default function SignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const t  = useTranslations('auth');
  const ts = useTranslations('auth.signUp');

  const [view, setView]               = useState<View>('register');
  const [firstName, setFirstName]     = useState('');
  const [lastName, setLastName]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [code, setCode]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [flash, setFlash]             = useState<Flash | null>(null);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    if (password !== confirm) {
      setFlash({ type: 'error', message: ts('passwordMismatch') });
      return;
    }
    setLoading(true);
    try {
      await signUp.create({ firstName, lastName, emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setView('verify');
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? 'Une erreur est survenue.';
      setFlash({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.push('/'); router.refresh();
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? 'Code invalide ou expiré.';
      setFlash({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!isLoaded) return;
    await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    setFlash({ type: 'success', message: ts('resend') });
  };

  const handleGoogle = async () => {
    if (!isLoaded) return;
    await signUp.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/sign-up', redirectUrlComplete: '/' });
  };

  const pwdMismatch = confirm.length > 0 && password !== confirm;

  return (
    <AnimatePresence mode="wait">

      {/* ══ REGISTER ══ */}
      {view === 'register' && (
        <motion.div key="register" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-3.5">

          <div className="text-center">
            <h1 className="text-xl font-bold text-text">{ts('title')}</h1>
            <p className="text-sm text-sub">{ts('subtitle')}</p>
          </div>

          <Flash flash={flash} />

          <form onSubmit={handleRegister} className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label={ts('firstName')}>
                <IconInput type="text" value={firstName} onChange={setFirstName} icon="fa-solid fa-user" placeholder={ts('firstNamePlaceholder')} />
              </Field>
              <Field label={ts('lastName')}>
                <IconInput type="text" value={lastName} onChange={setLastName} icon="fa-solid fa-user" placeholder={ts('lastNamePlaceholder')} />
              </Field>
            </div>

            <Field label={t('email')}>
              <IconInput type="email" value={email} onChange={setEmail} icon="fa-solid fa-envelope" placeholder={t('emailPlaceholder')} />
            </Field>

            <Field label={t('password')}>
              <PwdInput value={password} onChange={setPassword} show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
            </Field>

            <Field label={ts('confirmPassword')}>
              <PwdInput value={confirm} onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} error={pwdMismatch} />
              {pwdMismatch && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <i className="fa-solid fa-circle-exclamation" /> {ts('passwordMismatch')}
                </p>
              )}
            </Field>

            <p className="text-center text-xs text-sub leading-relaxed">
              En créant un compte, vous acceptez nos{' '}
              <Link href="/cgu" className="text-gold-dark hover:underline" target="_blank">CGU</Link>
              {' '}et notre{' '}
              <Link href="/confidentialite" className="text-gold-dark hover:underline" target="_blank">
                Politique de confidentialité
              </Link>.
            </p>

            <Btn loading={loading} disabled={!isLoaded || pwdMismatch}
              icon="fa-solid fa-user-plus" label={ts('submit')} loadingLabel={ts('submitting')} />
          </form>

          <Separator label={t('or')} />
          <GoogleBtn onClick={handleGoogle} label={t('google')} />

          <p className="text-center text-sm text-sub">
            {ts('hasAccount')}{' '}
            <Link href="/sign-in" className="font-semibold text-gold-dark hover:underline">{ts('login')}</Link>
          </p>
        </motion.div>
      )}

      {/* ══ VERIFY OTP ══ */}
      {view === 'verify' && (
        <motion.div key="verify" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-4">

          <button onClick={() => { setView('register'); setFlash(null); }}
            className="flex w-fit items-center gap-2 text-sm text-sub hover:text-text transition">
            <i className="fa-solid fa-arrow-left" /> {t('back')}
          </button>

          <div className="text-center">
            <h1 className="text-xl font-bold text-text">{ts('verifyTitle')}</h1>
            <p className="text-sm text-sub">
              {ts('verifySubtitle')} <span className="font-semibold text-text">{email}</span>
            </p>
          </div>

          <Flash flash={flash} />

          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <Field label={ts('verifyCode')}>
              <input type="text" inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" required
                className="w-full rounded-xl border border-line bg-bg py-3 text-center text-xl font-bold tracking-[0.5em] text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition" />
            </Field>

            <Btn loading={loading} disabled={code.length < 6}
              icon="fa-solid fa-circle-check" label={ts('verifySubmit')} loadingLabel={ts('verifySubmitting')} />
          </form>

          <p className="text-center text-sm text-sub">
            {ts('noCode')}{' '}
            <button onClick={handleResend} className="font-semibold text-gold-dark hover:underline">
              {ts('resend')}
            </button>
          </p>
        </motion.div>
      )}

    </AnimatePresence>
  );
}

/* ── Sub-components ── */

function Flash({ flash }: { flash: Flash | null }) {
  return (
    <AnimatePresence>
      {flash && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
            flash.type === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-green-200 bg-green-50 text-green-700'
          }`}>
          <i className={`shrink-0 text-sm ${flash.type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check'}`} />
          {flash.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">{label}</label>
      {children}
    </div>
  );
}

function IconInput({ type, value, onChange, icon, placeholder }: {
  type: string; value: string; onChange: (v: string) => void; icon: string; placeholder: string;
}) {
  return (
    <div className="relative">
      <i className={`${icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub`} />
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required
        className="w-full rounded-xl border border-line bg-bg py-2 pl-10 pr-4 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition" />
    </div>
  );
}

function PwdInput({ value, onChange, show, onToggle, error = false }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; error?: boolean;
}) {
  return (
    <div className="relative">
      <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••" required
        className={`w-full rounded-xl border py-2 pl-10 pr-11 text-sm text-text placeholder:text-sub outline-none transition bg-bg ${
          error ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/40' : 'border-line focus:border-gold focus:ring-1 focus:ring-gold/40'
        }`} />
      <button type="button" onClick={onToggle}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text transition"
        aria-label={show ? 'Masquer' : 'Afficher'}>
        <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
      </button>
    </div>
  );
}

function Btn({ loading, disabled = false, icon, label, loadingLabel }: {
  loading: boolean; disabled?: boolean; icon: string; label: string; loadingLabel: string;
}) {
  return (
    <button type="submit" disabled={loading || disabled} className="btn-gold justify-center disabled:opacity-50">
      {loading ? <><i className="fa-solid fa-spinner fa-spin" /> {loadingLabel}</> : <><i className={icon} /> {label}</>}
    </button>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line" />
      <span className="text-xs text-sub">{label}</span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} type="button"
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-card py-2 text-sm font-medium text-text transition hover:bg-gold-pale hover:border-gold/50">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {label}
    </button>
  );
}
