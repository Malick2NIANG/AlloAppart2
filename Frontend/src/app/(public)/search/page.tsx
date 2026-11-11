'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { resolveMiloRedirectParams } from '@/lib/milo';

/**
 * Lot « loupe du header » — /search n'affiche plus ses propres résultats :
 * la route reste valide (anciens liens/favoris) mais redirige désormais vers
 * /listings via Milo, comme tout autre point d'entrée (même repli q seul si
 * Milo est indisponible, cf. resolveMiloRedirectParams). `q` vide → /listings
 * nu (rien à chercher).
 */
export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteLocale = useLocale() as 'fr' | 'en';
  const t = useTranslations('search');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = searchParams.get('q')?.trim();

    if (!q) {
      router.replace('/listings');
      return;
    }

    let cancelled = false;
    void resolveMiloRedirectParams(q, siteLocale).then((params) => {
      if (cancelled) return;
      router.replace(`/listings?${params.toString()}`);
    });
    return () => { cancelled = true; };
  }, [router, searchParams, siteLocale]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3 text-center">
        <i className="fa-solid fa-circle-notch animate-spin text-2xl text-gold-dark" aria-hidden />
        <p className="text-sm text-sub">{t('redirecting')}</p>
      </div>
    </main>
  );
}
