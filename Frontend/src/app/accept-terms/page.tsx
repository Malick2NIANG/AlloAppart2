'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

/**
 * Écran de blocage : acceptation des CGU générales, requise pour tous les
 * rôles avant d'accéder à l'application. Atteint via le garde de
 * /redirect (!termsAcceptedAt) — couvre à la fois les comptes existants
 * (acceptation rétroactive) et les comptes créés par l'admin (PRO_AGENCE,
 * AGENT_TERRAIN) juste après leur changement de mot de passe obligatoire.
 */
export default function AcceptTermsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const t = useTranslations('acceptTerms');

  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!accepted) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('sessionExpired'));
      await api.patch('/auth/me/accept-terms', {}, token);
      router.push('/redirect');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorFallback'));
    } finally {
      setBusy(false);
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
          <div className="rounded-2xl border border-line bg-card p-6 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-file-signature text-xl text-gold-dark" />
              </div>
              <h1 className="text-xl font-bold text-text">{t('title')}</h1>
              <p className="mt-1 text-sm text-sub">{t('subtitle')}</p>
            </div>

            {error && (
              <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <i className="fa-solid fa-circle-exclamation shrink-0" /> {error}
              </p>
            )}

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-gold)" />
              <span className="text-sm text-text">
                {t('acceptLabel')}{' '}
                <Link href="/cgu" target="_blank" className="font-semibold text-gold-dark hover:underline">
                  {t('acceptTermsLink')}
                </Link>{' '}
                {t('acceptSuffix')}
              </span>
            </label>

            <button onClick={handleSubmit}
              disabled={!accepted || busy}
              className="btn-gold mt-5 w-full justify-center rounded-full py-3 text-sm font-bold disabled:opacity-50">
              {busy
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('saving')}</>
                : <><i className="fa-solid fa-circle-check" /> {t('continue')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
