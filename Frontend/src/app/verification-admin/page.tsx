'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

const RESEND_COOLDOWN_S = 60;

export default function VerificationAdminPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const t = useTranslations('verificationAdmin');

  const [code, setCode]         = useState('');
  const [sending, setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sentOnceRef = useRef(false);

  const sendCode = async (announce = false) => {
    setError(null);
    setSending(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('sessionExpired'));
      await api.post('/auth/admin-mfa/send', {}, token);
      if (announce) setInfo(t('sent'));
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      setError(t('sendError'));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.replace('/sign-in'); return; }
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;
    void sendCode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- envoi initial unique, cf. sentOnceRef
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setVerifying(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('sessionExpired'));
      await api.post('/auth/admin-mfa/verify', { code }, token);
      router.replace('/espace');
      router.refresh();
    } catch (err: unknown) {
      const msg = (err as { status?: number; message?: string } | undefined);
      setError(msg?.status === 400 ? t('invalidCode') : (msg?.message ?? t('invalidCode')));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div
        aria-hidden
        className="h-0.5 w-full shrink-0"
        style={{ background: 'linear-gradient(90deg, #facc15, #b58900, transparent)' }}
      />

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="relative rounded-2xl border border-line bg-card p-6 shadow-lg">
            <button
              type="button"
              onClick={() => void signOut({ redirectUrl: '/sign-in' })}
              aria-label={t('close')}
              title={t('close')}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-sub hover:bg-bg hover:text-text transition"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-shield-halved text-xl text-gold-dark" />
              </div>
              <h1 className="text-xl font-bold text-text">{t('title')}</h1>
              <p className="mt-1 text-sm text-sub">
                {t('subtitle', { email: user?.primaryEmailAddress?.emailAddress ?? '' })}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">{t('codeLabel')}</label>
                <input
                  type="text" inputMode="numeric" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456" required autoFocus
                  className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-center text-xl font-bold tracking-[0.5em] text-text outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition"
                />
              </div>

              {error && (
                <p className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                  <i className="fa-solid fa-circle-exclamation shrink-0" /> {error}
                </p>
              )}
              {info && !error && (
                <p className="flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <i className="fa-solid fa-circle-check shrink-0" /> {info}
                </p>
              )}

              <button type="submit" disabled={verifying || code.length < 6} className="btn-gold justify-center disabled:opacity-50">
                {verifying
                  ? <><i className="fa-solid fa-spinner fa-spin" /> {t('verifying')}</>
                  : <><i className="fa-solid fa-check" /> {t('verify')}</>
                }
              </button>

              <button
                type="button"
                onClick={() => void sendCode(true)}
                disabled={sending || cooldown > 0}
                className="text-center text-sm text-gold-dark hover:underline disabled:text-sub disabled:no-underline disabled:opacity-60"
              >
                {sending
                  ? t('sending')
                  : cooldown > 0
                    ? t('resendIn', { seconds: cooldown })
                    : t('resend')
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
