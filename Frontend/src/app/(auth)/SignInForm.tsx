'use client';

import { useState, useEffect } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

const slide = {
  enter:  { x: 20, opacity: 0 },
  center: { x: 0,  opacity: 1 },
  exit:   { x: -20, opacity: 0 },
};

type View = 'login' | 'forgot1' | 'forgot2' | 'forgot3' | 'second_factor';
interface Flash { type: 'error' | 'success' | 'info'; message: string; }

export default function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const t  = useTranslations('auth');
  const ts = useTranslations('auth.signIn');

  const [view, setView]               = useState<View>('login');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [code, setCode]               = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showNewPwd, setShowNewPwd]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [flash, setFlash]             = useState<Flash | null>(null);
  const [attempts, setAttempts]       = useState(3);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const res = await signIn.create({ identifier: email, password });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.push('/redirect');
        router.refresh();
      }
      if (res.status === 'needs_second_factor') {
        setView('second_factor');
        setFlash({ type: 'info', message: 'Un code de vérification a été envoyé à votre email.' });
        return;
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? 'Email ou mot de passe incorrect.';
      setFlash({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const handleSecondFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const res = await signIn.attemptSecondFactor({ strategy: 'email_code', code });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.push('/redirect');
        router.refresh();
      }
    } catch (err: unknown) {
      const msg =
        (err as { errors?: { message: string }[] })?.errors?.[0]?.message ??
        'Code invalide ou expiré.';
      setFlash({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isLoaded) return;
    await signIn.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/sign-in', redirectUrlComplete: '/' });
  };

  // Étape 1 — envoyer le code OTP par email
  const handleForgot1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || attempts <= 0) return;
    setLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setView('forgot2');
      setFlash(null);
    } catch {
      setAttempts((n) => n - 1);
      setFlash({ type: 'error', message: 'Adresse email introuvable.' });
    } finally { setLoading(false); }
  };

  // Étape 2 — vérifier le code OTP
  const handleForgot2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const res = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code });
      if (res.status === 'needs_new_password') {
        setView('forgot3');
        setFlash(null);
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? 'Code invalide ou expiré.';
      setFlash({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  // Étape 3 — définir le nouveau mot de passe
  const handleForgot3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    if (newPassword !== confirmPwd) {
      setFlash({ type: 'error', message: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setLoading(true);
    try {
      const res = await signIn.resetPassword({ password: newPassword });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.push('/'); router.refresh();
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? 'Erreur lors de la réinitialisation.';
      setFlash({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const goLogin = () => {
    setView('login'); setFlash(null);
    setCode(''); setNewPassword(''); setConfirmPwd('');
  };

  return (
    <AnimatePresence mode="wait">

      {/* ══ LOGIN ══ */}
      {view === 'login' && (
        <motion.div key="login" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-4">

          <div className="text-center">
            <h1 className="text-xl font-bold text-text">{ts('title')}</h1>
            <p className="text-sm text-sub">{ts('subtitle')}</p>
          </div>

          <Flash flash={flash} />

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <Field label={t('email')}>
              <IconInput type="email" value={email} onChange={setEmail} icon="fa-solid fa-envelope" placeholder={t('emailPlaceholder')} />
            </Field>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-text">{t('password')}</label>
                <button type="button" onClick={() => setView('forgot1')} className="text-xs text-gold-dark hover:underline">
                  {ts('forgotPassword')}
                </button>
              </div>
              <PwdInput value={password} onChange={setPassword} show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
            </div>

            <Btn loading={loading} disabled={!isLoaded} icon="fa-solid fa-right-to-bracket" label={ts('submit')} loadingLabel={ts('submitting')} />
          </form>

          <Separator label={t('or')} />
          <GoogleBtn onClick={handleGoogle} label={t('google')} />

          <p className="text-center text-sm text-sub">
            {ts('noAccount')}{' '}
            <Link href="/sign-up" className="font-semibold text-gold-dark hover:underline">{ts('register')}</Link>
          </p>
        </motion.div>
      )}

      {/* ══ FORGOT 1 — saisie email ══ */}
      {view === 'forgot1' && (
        <motion.div key="forgot1" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-4">

          <BackBtn onClick={goLogin} label={t('back')} />

          <div className="text-center">
            <h1 className="text-xl font-bold text-text">{ts('forgotTitle')}</h1>
            <p className="text-sm text-sub">{ts('forgotSubtitle')}</p>
          </div>

          <Flash flash={flash} />

          {attempts === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <i className="fa-solid fa-shield-halved mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{ts('tooManyTitle')}</p>
                <p className="mt-0.5 text-xs">{ts('tooManyDesc')}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgot1} className="flex flex-col gap-3">
              <div>
                <Field label={t('email')}>
                  <IconInput type="email" value={email} onChange={setEmail} icon="fa-solid fa-envelope" placeholder={t('emailPlaceholder')} />
                </Field>
                {attempts < 3 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <i className="fa-solid fa-triangle-exclamation" />
                    {ts('attemptsLeft', { count: attempts })}
                  </p>
                )}
              </div>
              <Btn loading={loading} icon="fa-solid fa-paper-plane" label={ts('forgotSubmit')} loadingLabel={ts('forgotSubmitting')} />
            </form>
          )}
        </motion.div>
      )}

      {/* ══ FORGOT 2 — saisie code OTP ══ */}
      {view === 'forgot2' && (
        <motion.div key="forgot2" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-4">

          <BackBtn onClick={() => setView('forgot1')} label={t('back')} />

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
              <i className="fa-solid fa-envelope-open-text text-xl text-gold-dark" />
            </div>
            <h2 className="text-xl font-bold text-text">Vérifiez votre email</h2>
            <p className="mt-1 text-sm text-sub">
              Un code à 6 chiffres a été envoyé à <span className="font-semibold text-text">{email}</span>
            </p>
          </div>

          <Flash flash={flash} />

          <form onSubmit={handleForgot2} className="flex flex-col gap-3">
            <Field label="Code de vérification">
              <div className="relative">
                <i className="fa-solid fa-hashtag absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  className="w-full rounded-xl border border-line bg-bg py-2 pl-10 pr-4 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 tracking-widest transition"
                />
              </div>
            </Field>
            <Btn loading={loading} icon="fa-solid fa-check" label="Vérifier le code" loadingLabel="Vérification…" />
          </form>

          <p className="text-center text-xs text-sub">
            Pas reçu ?{' '}
            <button type="button" onClick={() => { setView('forgot1'); setFlash(null); }}
              className="font-medium text-gold-dark hover:underline">
              Renvoyer
            </button>
          </p>
        </motion.div>
      )}

      {/* ══ FORGOT 3 — nouveau mot de passe ══ */}
      {view === 'forgot3' && (
        <motion.div key="forgot3" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-4">

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
              <i className="fa-solid fa-lock-open text-xl text-gold-dark" />
            </div>
            <h2 className="text-xl font-bold text-text">Nouveau mot de passe</h2>
            <p className="mt-1 text-sm text-sub">Choisissez un mot de passe sécurisé</p>
          </div>

          <Flash flash={flash} />

          <form onSubmit={handleForgot3} className="flex flex-col gap-3">
            <Field label="Nouveau mot de passe">
              <PwdInput value={newPassword} onChange={setNewPassword} show={showNewPwd} onToggle={() => setShowNewPwd(!showNewPwd)} />
            </Field>
            <Field label="Confirmer le mot de passe">
              <PwdInput value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
            </Field>
            {newPassword && confirmPwd && newPassword !== confirmPwd && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <i className="fa-solid fa-circle-xmark" /> Les mots de passe ne correspondent pas
              </p>
            )}
            <Btn loading={loading} icon="fa-solid fa-shield-check" label="Réinitialiser" loadingLabel="Enregistrement…" />
          </form>
        </motion.div>
      )}

      {/* ══ SECOND FACTOR — code 2FA ══ */}
      {view === 'second_factor' && (
        <motion.div key="second_factor" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-4">

          <BackBtn onClick={() => { setView('login'); setFlash(null); setCode(''); }} label={t('back')} />

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
              <i className="fa-solid fa-shield-halved text-xl text-gold-dark" />
            </div>
            <h2 className="text-xl font-bold text-text">Vérification en deux étapes</h2>
            <p className="mt-1 text-sm text-sub">Entrez le code envoyé à votre adresse email.</p>
          </div>

          <Flash flash={flash} />

          <form onSubmit={handleSecondFactor} className="flex flex-col gap-3">
            <Field label="Code de vérification">
              <div className="relative">
                <i className="fa-solid fa-hashtag absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className="w-full rounded-xl border border-line bg-bg py-2 pl-10 pr-4 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 tracking-widest transition"
                />
              </div>
            </Field>
            <Btn loading={loading} icon="fa-solid fa-check" label="Vérifier" loadingLabel="Vérification…" />
          </form>
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
            flash.type === 'error' ? 'border border-red-200 bg-red-50 text-red-700'
            : flash.type === 'info' ? 'border border-blue-200 bg-blue-50 text-blue-700'
            : 'border border-green-200 bg-green-50 text-green-700'
          }`}>
          <i className={`shrink-0 text-sm ${
            flash.type === 'error' ? 'fa-solid fa-circle-exclamation'
            : flash.type === 'info' ? 'fa-solid fa-circle-info'
            : 'fa-solid fa-circle-check'
          }`} />
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

function PwdInput({ value, onChange, show, onToggle }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div className="relative">
      <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••" required
        className="w-full rounded-xl border border-line bg-bg py-2 pl-10 pr-11 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition" />
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

function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex w-fit items-center gap-2 text-sm text-sub hover:text-text transition">
      <i className="fa-solid fa-arrow-left" /> {label}
    </button>
  );
}
