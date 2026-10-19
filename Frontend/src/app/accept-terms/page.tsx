'use client';

import { useState } from 'react';
import Image from 'next/image';
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
    // max-md:min-h-dvh (lot 1) : tient compte du clavier virtuel sous 768px.
    // Sans effet à partir de 768px (min-h-screen inchangé).
    <div className="flex min-h-screen max-md:min-h-dvh flex-col bg-bg">
      <div
        aria-hidden
        className="h-0.5 w-full shrink-0"
        style={{ background: 'linear-gradient(90deg, #facc15, #b58900, transparent)' }}
      />

      {/* Logo — mobile uniquement (lot 1). Sans effet à partir de 768px. */}
      <div className="md:hidden flex justify-center pt-5 shrink-0">
        <Image src="/images/LOGO.png" alt="AlloAppart" width={220} height={63} className="h-9 w-auto" priority />
      </div>

      {/* Marges 16px + padding bas incluant --safe-bottom sous 768px (lot 1) ;
          px-6/py-10 inchangés à partir de 768px. */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 md:px-6 max-md:pb-[calc(2.5rem+var(--safe-bottom,0px))]">
        <div className="w-full max-w-sm">
          {/* Carte flottante retirée sous 768px (mode app) ; inchangée à
              partir de 768px. */}
          <div className="rounded-2xl border border-line bg-card p-6 shadow-lg max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-file-signature text-xl text-gold-dark" />
              </div>
              <h1 className="text-xl font-bold text-text">{t('title')}</h1>
              <p className="mt-1 text-sm text-sub">{t('subtitle')}</p>
            </div>

            {error && (
              <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
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
