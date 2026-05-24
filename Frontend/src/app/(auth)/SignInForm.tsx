'use client';

import { useState, useEffect } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

type DemoRole = 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

const DEMO_USERS: {
  email: string; name: string; initials: string;
  role: DemoRole; roleLabel: string; roleBadge: string;
  href: string; actif: boolean;
}[] = [
  {
    email: 'mamadou@demo.sn', name: 'Mamadou Diallo', initials: 'MD',
    role: 'locataire', roleLabel: 'Locataire',
    roleBadge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    href: '/espace', actif: true,
  },
  {
    email: 'binta@demo.sn', name: 'Binta Sarr', initials: 'BS',
    role: 'bailleur', roleLabel: 'Bailleur',
    roleBadge: 'bg-gold-pale text-gold-dark',
    href: '/espace', actif: true,
  },
  {
    email: 'ousmane@demo.sn', name: 'Ousmane Thiaw', initials: 'OT',
    role: 'dual', roleLabel: 'Loc. + Bailleur',
    roleBadge: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    href: '/espace', actif: true,
  },
  {
    email: 'admin@demo.sn', name: 'Modou Kane', initials: 'MK',
    role: 'admin', roleLabel: 'Administrateur',
    roleBadge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    href: '/espace', actif: true,
  },
  {
    email: 'agent@demo.sn', name: 'Awa Diop', initials: 'AD',
    role: 'agent', roleLabel: 'Agent vérif.',
    roleBadge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    href: '/espace', actif: true,
  },
];

const slide = {
  enter:  { x: 20, opacity: 0 },
  center: { x: 0,  opacity: 1 },
  exit:   { x: -20, opacity: 0 },
};

type View = 'login' | 'forgot1' | 'forgot2';
interface Flash { type: 'error' | 'success'; message: string; }

export default function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const t  = useTranslations('auth');
  const ts = useTranslations('auth.signIn');

  const [view, setView]         = useState<View>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [flash, setFlash]       = useState<Flash | null>(null);
  const [attempts, setAttempts] = useState(3);
  const [showDemo, setShowDemo] = useState(false);

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
        router.push('/'); router.refresh();
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message ?? 'Email ou mot de passe incorrect.';
      setFlash({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    if (!isLoaded) return;
    await signIn.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/sign-in', redirectUrlComplete: '/' });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || attempts <= 0) return;
    setLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setView('forgot2');
    } catch {
      setAttempts((n) => n - 1);
      setFlash({ type: 'error', message: 'Adresse email introuvable.' });
    } finally { setLoading(false); }
  };

  const quickLogin = (user: typeof DEMO_USERS[number]) => {
    localStorage.setItem('aa_demo_role', user.role);
    window.dispatchEvent(new CustomEvent('aa-demo-change', { detail: user.role }));
    router.push(user.href);
  };

  const goLogin = () => { setView('login'); setFlash(null); };

  const demoUsers = DEMO_USERS.filter((u) => u.actif);

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

          {/* ── Accès démo ── */}
          <div className="border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="mx-auto flex items-center gap-1.5 text-xs text-sub/60 hover:text-sub transition-colors"
            >
              Accès démo rapide
              <motion.i
                className="fa-solid fa-chevron-down text-[10px]"
                animate={{ rotate: showDemo ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </button>

            <AnimatePresence initial={false}>
              {showDemo && (
                <motion.div
                  key="demo-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2 pt-3">
                    {demoUsers.map((u) => (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => quickLogin(u)}
                        className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 text-left transition-all duration-200 hover:border-gold/50 hover:bg-gold-pale group"
                      >
                        {/* Avatar initiales */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale text-xs font-bold text-gold-dark ring-1 ring-gold/30 group-hover:ring-gold/60 transition">
                          {u.initials}
                        </div>

                        {/* Infos */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text truncate">{u.name}</p>
                          <p className="text-xs text-sub truncate">{u.email}</p>
                        </div>

                        {/* Badge rôle */}
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${u.roleBadge}`}>
                          {u.roleLabel}
                        </span>
                      </button>
                    ))}

                    <p className="text-center text-[10px] text-sub/50 pt-0.5">
                      Sans compte réel · Uniquement pour les présentations
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </motion.div>
      )}

      {/* ══ FORGOT 1 ══ */}
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
            <form onSubmit={handleForgot} className="flex flex-col gap-3">
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

      {/* ══ FORGOT 2 ══ */}
      {view === 'forgot2' && (
        <motion.div key="forgot2" variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.25 }} className="flex flex-col gap-4">

          <BackBtn onClick={goLogin} label={t('back')} />

          <div className="text-center">
            <h2 className="text-xl font-bold text-text">{ts('emailSentTitle')}</h2>
            <p className="text-sm text-sub max-w-xs">
              {ts('emailSentDesc')}{' '}
              <span className="font-semibold text-text">{email}</span>.
            </p>
          </div>

          <button onClick={goLogin} className="btn-outline justify-center text-text">
            <i className="fa-solid fa-right-to-bracket" /> {ts('backToLogin')}
          </button>
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
