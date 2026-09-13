'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type VerificationResult =
  | {
      valid: true;
      tenant: { firstName: string; lastName: string; avatar: string | null };
      listing: { title: string; city: string };
      booking: {
        type: 'NIGHTLY' | 'MONTHLY';
        startDate: string;
        endDate: string | null;
        status: string;
      };
    }
  | { valid: false; reason: string };

/**
 * Page publique scannée par le bailleur (QR affiché par le locataire) — ne
 * requiert ni compte AlloAppart ni connexion. Le token est vérifié côté
 * serveur (signature HMAC + statut/fenêtre de dates live) ; cette page ne
 * fait qu'afficher le résultat.
 */
export default function VerifyBookingPage() {
  const { token } = useParams<{ token: string }>();
  const t = useTranslations('verification');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<VerificationResult>(`/bookings/verify/${token}`);
        if (!cancelled) setResult(data);
      } catch {
        if (!cancelled) setResult({ valid: false, reason: 'INVALID' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Clés déclarées explicitement (plutôt qu'interpolées dans t()) pour que
  // le script de parité i18n détecte bien chaque variante utilisée.
  const reasonLabel = (reason: string): string => {
    switch (reason) {
      case 'NOT_FOUND': return t('reasonNOT_FOUND');
      case 'CANCELLED': return t('reasonCANCELLED');
      case 'NOT_CONFIRMED': return t('reasonNOT_CONFIRMED');
      case 'TOO_EARLY': return t('reasonTOO_EARLY');
      case 'EXPIRED': return t('reasonEXPIRED');
      case 'TERMINATED': return t('reasonTERMINATED');
      case 'NOT_ACTIVE': return t('reasonNOT_ACTIVE');
      default: return t('reasonINVALID');
    }
  };

  return (
    <div className="aa-container py-16 flex flex-col items-center text-center">
      {loading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-gold-dark" />
        </div>
      )}

      {!loading && result && !result.valid && (
        <>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
            <i className="fa-solid fa-circle-xmark text-3xl text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-text">{t('invalidTitle')}</h1>
          <p className="mt-2 max-w-md text-sub">{reasonLabel(result.reason)}</p>
        </>
      )}

      {!loading && result && result.valid && (
        <>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
            <i className="fa-solid fa-circle-check text-3xl text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-text">{t('validTitle')}</h1>
          <p className="mt-2 max-w-md text-sub">{t('validDesc')}</p>

          <div className="mt-8 w-full max-w-sm rounded-2xl border border-line bg-card p-5 text-left">
            <div className="flex items-center gap-3">
              {result.tenant.avatar ? (
                <div className="relative h-14 w-14 overflow-hidden rounded-full border border-line shrink-0">
                  <Image
                    src={result.tenant.avatar}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-gold-pale text-lg font-bold text-gold-dark">
                  {result.tenant.firstName.charAt(0)}
                  {result.tenant.lastName.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-xs text-sub">{t('tenantLabel')}</p>
                <p className="font-semibold text-text">
                  {result.tenant.firstName} {result.tenant.lastName}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs text-sub">{t('listingLabel')}</p>
              <p className="font-medium text-text">{result.listing.title}</p>
              <p className="text-sm text-sub">{result.listing.city}</p>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs text-sub">{t('datesLabel')}</p>
              <p className="text-sm text-text">
                <i className="fa-regular fa-calendar text-gold-dark text-xs mr-1" />
                {formatDate(result.booking.startDate)}
                {result.booking.endDate ? ` → ${formatDate(result.booking.endDate)}` : ''}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <span className="text-sm text-sub">{t('statusLabel')}</span>
              <span className="rounded-full bg-green-100 dark:bg-green-950/40 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                {t(result.booking.type === 'MONTHLY' ? 'statusActiveLease' : 'statusConfirmedStay')}
              </span>
            </div>
          </div>
        </>
      )}

      <Link href="/" className="mt-8 rounded-xl border border-line bg-card px-6 py-2.5 text-sm font-medium text-sub hover:text-text transition-colors">
        {t('backHome')}
      </Link>
    </div>
  );
}
