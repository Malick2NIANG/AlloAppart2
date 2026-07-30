'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { type Listing, type PaginatedResponse, priceToNumber } from '@/types';
import { useToast } from '@/components/ui/Toast';

const TYPE_LABEL_EN: Record<string, string> = {
  APPARTEMENT: 'Apartment', STUDIO: 'Studio', VILLA: 'Villa',
  BUREAU: 'Office', CHAMBRE: 'Room', MAISON: 'House',
};
const TYPE_LABEL_FR: Record<string, string> = {
  APPARTEMENT: 'Appartement', STUDIO: 'Studio', VILLA: 'Villa',
  BUREAU: 'Bureau', CHAMBRE: 'Chambre', MAISON: 'Maison',
};

function BoostStatusBadge({ boostUntil, t, numLocale }: {
  boostUntil?: string | null;
  t: ReturnType<typeof useTranslations>;
  numLocale: string;
}) {
  if (!boostUntil) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-bg border border-line px-2.5 py-0.5 text-[11px] font-medium text-sub">
        <i className="fa-solid fa-minus text-[9px]" /> {t('boostStatusNone')}
      </span>
    );
  }
  const until = new Date(boostUntil);
  const now = new Date();
  if (until <= now) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-medium text-red-600">
        <i className="fa-solid fa-circle-xmark text-[9px]" /> {t('boostStatusExpired', { date: until.toLocaleDateString(numLocale) })}
      </span>
    );
  }
  const diffDays = Math.ceil((until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-pale border border-gold/30 px-2.5 py-0.5 text-[11px] font-bold text-gold-dark">
      <i className="fa-solid fa-bolt text-[9px]" /> {t('boostStatusActive', { days: diffDays })}
    </span>
  );
}

export default function BoostPage() {
  const { getToken } = useAuth();
  const t            = useTranslations('bailleur');
  const locale       = useLocale();
  const numLocale    = locale === 'en' ? 'en-US' : 'fr-FR';
  const typeLabel    = locale === 'en' ? TYPE_LABEL_EN : TYPE_LABEL_FR;
  const searchParams = useSearchParams();
  const { toast }    = useToast();
  const toastRef     = useRef(toast);
  toastRef.current   = toast;

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Handle PayDunya return ?status=boost_success|boost_cancel
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'boost_success') toastRef.current.success(t('boostSuccess'));
    if (status === 'boost_cancel')  toastRef.current.error(t('abonnementPaymentCancelled'));
  }, [searchParams, t]);

  const load = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get<PaginatedResponse<Listing>>('/listings/mine?limit=100', token);
      setListings(Array.isArray(res?.data) ? res.data : []);
    } catch {
      toastRef.current.error(t('boostLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  useEffect(() => { void load(); }, [load]);

  const handleBoost = async (listingId: string) => {
    setConfirmId(null);
    setBoosting(listingId);
    const token = await getToken();
    try {
      const res = await api.post<{ payment_url?: string }>(`/listings/${listingId}/boost`, {}, token ?? undefined);
      if (res?.payment_url) {
        window.location.href = res.payment_url;
      } else {
        await load();
        toast.success(t('boostSuccess'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('boostError'));
    } finally {
      setBoosting(null);
    }
  };

  const now = new Date();
  const boosted   = listings.filter((l) => l.boostUntil && new Date(l.boostUntil) > now);
  const unboosted = listings.filter((l) => !l.boostUntil || new Date(l.boostUntil) <= now);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-line bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <i className="fa-solid fa-rocket text-gold-dark text-xl" />
          {t('boostPageTitle')}
        </h1>
        <p className="mt-1 text-sm text-sub">{t('boostPageSubtitle')}</p>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-gold/30 bg-gold-pale/40 p-5 flex flex-wrap gap-4 items-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20">
          <i className="fa-solid fa-bolt text-gold-dark" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">{t('boostHowTitle')}</p>
          <p className="text-xs text-sub mt-1 leading-relaxed">{t('boostHowDesc')}</p>
        </div>
      </div>

      {/* Boosted listings */}
      {boosted.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
            <i className="fa-solid fa-bolt text-gold-dark text-xs" />
            {t('boostSectionBoosted', { count: boosted.length })}
          </h2>
          <div className="flex flex-col gap-3">
            {boosted.map((listing) => (
              <ListingBoostCard
                key={listing.id}
                listing={listing}
                boosting={boosting}
                onBoost={() => setConfirmId(listing.id)}
                t={t}
                numLocale={numLocale}
                typeLabel={typeLabel}
              />
            ))}
          </div>
        </section>
      )}

      {/* Unboosted listings */}
      {unboosted.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
            <i className="fa-solid fa-house text-sub text-xs" />
            {t('boostSectionUnboosted', { count: unboosted.length })}
          </h2>
          <div className="flex flex-col gap-3">
            {unboosted.map((listing) => (
              <ListingBoostCard
                key={listing.id}
                listing={listing}
                boosting={boosting}
                onBoost={() => setConfirmId(listing.id)}
                t={t}
                numLocale={numLocale}
                typeLabel={typeLabel}
              />
            ))}
          </div>
        </section>
      )}

      {listings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-gold-pale grid place-items-center">
            <i className="fa-solid fa-house-circle-xmark text-gold-dark text-2xl" />
          </div>
          <p className="text-sub text-sm">{t('boostNoListings')}</p>
          <Link href="/bailleur/listings" className="btn-gold text-sm">
            <i className="fa-solid fa-plus text-xs mr-1.5" />{t('boostPublishLink')}
          </Link>
        </div>
      )}

      {/* Boost confirmation modal */}
      {confirmId && (() => {
        const listing = listings.find((l) => l.id === confirmId);
        if (!listing) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-pale">
                <i className="fa-solid fa-rocket text-gold-dark text-xl" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900">{t('boostConfirmTitle')}</h2>
              <p className="text-sm text-gray-800/80 mt-1 truncate">&ldquo;{listing.title}&rdquo;</p>

              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                {[
                  { icon: 'fa-eye',        color: 'text-blue-500',   text: t('boostConfirm1') },
                  { icon: 'fa-trophy',     color: 'text-gold-dark',  text: t('boostConfirm2') },
                  { icon: 'fa-chart-line', color: 'text-purple-500', text: t('boostConfirm3') },
                ].map(({ icon, color, text }) => (
                  <li key={text} className="flex items-center gap-2">
                    <i className={`fa-solid ${icon} ${color} w-4 text-center text-sm`} />
                    {text}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmId(null)}
                  className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:bg-bg transition"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => void handleBoost(confirmId)}
                  disabled={boosting !== null}
                  className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-gray-900 hover:bg-gold-dark transition disabled:opacity-60"
                >
                  {boosting === confirmId
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-rocket mr-1.5" />{t('boostConfirmPay')}</>
                  }
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] text-sub">{t('boostConfirmNote')}</p>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

function ListingBoostCard({
  listing, boosting, onBoost, t, numLocale, typeLabel,
}: {
  listing: Listing;
  boosting: string | null;
  onBoost: () => void;
  t: ReturnType<typeof useTranslations>;
  numLocale: string;
  typeLabel: Record<string, string>;
}) {
  const now      = new Date();
  const img      = listing.images?.[0] ?? 'https://via.placeholder.com/80x60?text=AA';
  const isBoosted = !!listing.boostUntil && new Date(listing.boostUntil) > now;

  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
      isBoosted ? 'border-gold/40 bg-gold-pale/20' : 'border-line bg-card'
    }`}>
      {/* Image */}
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl">
        <Image src={img} alt={listing.title} fill className="object-cover" sizes="80px" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <Link
            href={`/listings/${listing.id}`}
            className="text-sm font-semibold text-text hover:text-gold-dark transition-colors truncate"
          >
            {listing.title}
          </Link>
          <BoostStatusBadge boostUntil={listing.boostUntil} t={t} numLocale={numLocale} />
        </div>
        <p className="mt-0.5 text-xs text-sub">
          {listing.city} · {typeLabel[listing.type] ?? listing.type} ·{' '}
          {priceToNumber(listing.price).toLocaleString(numLocale)} FCFA/mois
        </p>
        {listing.boostScore > 0 && (
          <p className="mt-0.5 text-[11px] text-purple-600">
            <i className="fa-solid fa-chart-line text-[9px] mr-1" />
            {t('boostScore', { score: listing.boostScore })}
          </p>
        )}
      </div>

      {/* Action */}
      <button
        onClick={onBoost}
        disabled={boosting !== null}
        className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
          isBoosted
            ? 'border border-gold/40 bg-white text-gold-dark hover:bg-gold-pale'
            : 'bg-gold text-gray-900 hover:bg-gold-dark'
        }`}
      >
        {boosting === listing.id
          ? <i className="fa-solid fa-spinner fa-spin" />
          : <><i className="fa-solid fa-rocket text-[10px]" />{isBoosted ? t('boostRenew') : t('boostAction')}</>
        }
      </button>
    </div>
  );
}
