'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { openPaymentTab, redirectPaymentTab, closePaymentTab } from '@/lib/utils';
import { type Listing, type PaginatedResponse, getListingPriceAmounts } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';
import { BookingSearchRow } from '@/components/bookings/BookingSearchRow';
import { BookingPagination } from '@/components/bookings/BookingPagination';

// Mêmes tailles de page que les autres grilles de cartes de l'espace bailleur
// (cf. bailleur/bookings, AgenceClientShell) — on garde un pattern unique.
const PER_PAGE_OPTIONS = [6, 12, 24] as const;
type BoostFilter = 'ALL' | 'BOOSTED' | 'UNBOOSTED';

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
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-2.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
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
  useEffect(() => { toastRef.current = toast; });

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoostFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<typeof PER_PAGE_OPTIONS[number]>(6);
  // Bannière "Comment fonctionne le Boost ?" — fermeture persistée (pas de
  // date, contrairement à SubscriptionAlert : c'est une info statique, pas
  // une alerte qui redevient pertinente chaque jour).
  const [howDismissed, setHowDismissed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('boost_how_dismissed') === '1'
  );
  const dismissHow = () => {
    localStorage.setItem('boost_how_dismissed', '1');
    setHowDismissed(true);
  };
  // Abonnement PRO actif = boost illimité gratuit (cf. isProActive() backend).
  // /subscriptions/me est réservé PRO_AGENCE/ADMIN : un simple BAILLEUR reçoit un 403, traité
  // ici comme "pas PRO" (même schéma défensif que bailleur/listings).
  const [isProActive, setIsProActive] = useState(false);

  useEffect(() => {
    void getToken().then((token) => {
      if (!token) return;
      api.get<{ plan: string; status: string }>('/subscriptions/me', token)
        .then((sub) => setIsProActive(sub?.plan === 'PRO' && sub?.status === 'ACTIVE'))
        .catch(() => setIsProActive(false));
    });
  }, [getToken]);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial, setState après résolution async
  useEffect(() => { void load(); }, [load]);

  const handleBoost = async (listingId: string) => {
    setConfirmId(null);
    setBoosting(listingId);
    // Réservé de façon SYNCHRONE avant tout `await`, sinon le navigateur
    // bloque le popup — on ne sait pas encore à ce stade si ce boost sera
    // payant ou gratuit (PRO), donc on réserve l'onglet par précaution et on
    // le referme aussitôt s'il s'avère finalement inutile (boost gratuit).
    const paymentTab = openPaymentTab();
    const token = await getToken();
    try {
      const res = await api.post<{ payment_url?: string }>(
        `/listings/${listingId}/boost`, {}, token ?? undefined,
      );
      if (!res?.payment_url) {
        closePaymentTab(paymentTab);
        await load();
        toast.success(t('boostSuccess'));
        return;
      }
      // PayDunya gère entièrement le choix du mode de paiement sur sa
      // propre page hébergée ; on ne fait que rediriger.
      redirectPaymentTab(paymentTab, res.payment_url);
    } catch (err) {
      closePaymentTab(paymentTab);
      toast.error(err instanceof Error ? err.message : t('boostError'));
    } finally {
      setBoosting(null);
    }
  };

  const now = new Date();
  const boosted   = listings.filter((l) => l.boostUntil && new Date(l.boostUntil) > now);
  const unboosted = listings.filter((l) => !l.boostUntil || new Date(l.boostUntil) <= now);

  // Reset pagination dès qu'un filtre/la recherche/la taille de page change —
  // même pattern que bailleur/bookings et bailleur/listings.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination suite à un changement de filtre/recherche
  useEffect(() => { setPage(1); }, [filter, search, perPage]);

  const base = filter === 'BOOSTED' ? boosted : filter === 'UNBOOSTED' ? unboosted : listings;
  const q = search.trim().toLowerCase();
  const filtered = base.filter((l) => !q || l.title.toLowerCase().includes(q) || l.city.toLowerCase().includes(q));
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const clampedPage = Math.min(page, pageCount);
  const visible = filtered.slice((clampedPage - 1) * perPage, clampedPage * perPage);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl border border-line bg-card animate-pulse" />
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
      {!howDismissed && (
        <div className="rounded-2xl border border-gold/30 dark:border-gold/20 bg-gold-pale/40 dark:bg-gold-dark/10 p-5 flex flex-wrap gap-4 items-start relative">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20">
            <i className="fa-solid fa-bolt text-gold-dark" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-sm font-semibold text-text">{t('boostHowTitle')}</p>
            <p className="text-xs text-sub mt-1 leading-relaxed">{t('boostHowDesc')}</p>
          </div>
          <button
            onClick={dismissHow}
            aria-label={t('boostHowDismiss')}
            className="absolute top-4 right-4 text-sub hover:text-text transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-gold-pale grid place-items-center">
            <i className="fa-solid fa-house-circle-xmark text-gold-dark text-2xl" />
          </div>
          <p className="text-sub text-sm">{t('boostNoListings')}</p>
          <Link href="/bailleur/listings" className="btn-gold text-sm">
            <i className="fa-solid fa-plus text-xs mr-1.5" />{t('boostPublishLink')}
          </Link>
        </div>
      ) : (
        <div>
          {/* Stats par statut — doublent aussi de filtre cliquable (même
              pattern que bailleur/bookings). */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <StatFilterCard
              icon="fa-layer-group"
              label={t('boostFilterAll')}
              value={listings.length}
              color="text-gold-dark"
              bg="bg-gold-pale/40 dark:bg-gold-dark/10"
              active={filter === 'ALL'}
              onClick={() => setFilter('ALL')}
              selectedLabel={t('filterSelected')}
            />
            <StatFilterCard
              icon="fa-bolt"
              label={t('boostFilterBoosted')}
              value={boosted.length}
              color="text-gold-dark"
              bg="bg-gold-pale dark:bg-gold-dark/15"
              active={filter === 'BOOSTED'}
              onClick={() => setFilter('BOOSTED')}
              selectedLabel={t('filterSelected')}
            />
            <StatFilterCard
              icon="fa-house"
              label={t('boostFilterUnboosted')}
              value={unboosted.length}
              color="text-sub"
              bg="bg-card"
              active={filter === 'UNBOOSTED'}
              onClick={() => setFilter('UNBOOSTED')}
              selectedLabel={t('filterSelected')}
            />
          </div>

          {/* Recherche + lignes par page — même composant que bailleur/bookings */}
          <BookingSearchRow
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('boostSearchPlaceholder')}
            perPage={perPage}
            onPerPageChange={(n) => setPerPage(n as typeof PER_PAGE_OPTIONS[number])}
            perPageOptions={PER_PAGE_OPTIONS}
            rowsLabel={t('rowsLabel')}
          />

          {/* Grille d'annonces */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-sub">{q ? t('noResultsFor', { search }) : t('boostFilterEmpty')}</p>
              {q && (
                <button onClick={() => setSearch('')} className="mt-3 text-sm text-gold-dark hover:underline">
                  {t('clearSearch')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visible.map((listing) => (
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
          )}

          {/* Pagination */}
          <BookingPagination
            page={clampedPage}
            pageCount={pageCount}
            onPageChange={setPage}
            previousLabel={t('previous')}
            nextLabel={t('next')}
            pageOfLabel={t('pageOf', { page: clampedPage, total: pageCount })}
          />
        </div>
      )}

      {/* Boost confirmation modal — même modal que bailleur/listings (unifié
          le 2026-09-24, cf. décision : un seul style, prix/durée/PRO visibles). */}
      {confirmId && (() => {
        const listing = listings.find((l) => l.id === confirmId);
        if (!listing) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">
              <div className="bg-linear-to-r from-gold to-gold-light px-6 py-5 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 mb-3">
                  <i className="fa-solid fa-rocket text-white text-2xl" />
                </div>
                <h2 className="text-xl font-extrabold text-gray-900">{t('boostListModalTitle')}</h2>
                <p className="text-sm text-gray-800/80 mt-1 truncate">&ldquo;{listing.title}&rdquo;</p>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between rounded-2xl border border-gold/30 dark:border-gold/20 bg-gold-pale/60 dark:bg-gold-dark/10 px-5 py-4 mb-5">
                  <div>
                    <p className="text-xs font-bold text-sub uppercase tracking-wider">{t('boostPriceLabel')}</p>
                    {isProActive ? (
                      <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{t('boostFreePro')}</p>
                    ) : (
                      <p className="text-3xl font-extrabold text-text mt-0.5">5 000 <span className="text-lg font-semibold">FCFA</span></p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-sub uppercase tracking-wider">{t('boostDurationLabel')}</p>
                    <p className="text-3xl font-extrabold text-gold-dark mt-0.5">7 <span className="text-lg font-semibold">{t('boostDurationDays')}</span></p>
                  </div>
                </div>
                {isProActive && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 -mt-3 mb-5 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-check" /> {t('boostFreeProNote')}
                  </p>
                )}

                <div className="space-y-2.5 mb-6">
                  {[
                    { icon: 'fa-bolt',       color: 'text-gold-dark',   text: t('boostListBenefit1') },
                    { icon: 'fa-arrow-up',   color: 'text-emerald-600 dark:text-emerald-400', text: t('boostListBenefit2') },
                    { icon: 'fa-eye',        color: 'text-blue-500 dark:text-blue-400',        text: t('boostListBenefit3') },
                    { icon: 'fa-chart-line', color: 'text-purple-500 dark:text-purple-400',    text: t('boostListBenefit4') },
                  ].map((item) => (
                    <div key={item.icon} className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg border border-line ${item.color}`}>
                        <i className={`fa-solid ${item.icon} text-xs`} />
                      </span>
                      <p className="text-sm text-text">{item.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmId(null)}
                    className="flex-1 rounded-xl border border-line py-3 text-sm font-medium text-sub hover:text-text hover:border-text/30 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    // eslint-disable-next-line react-hooks/refs -- faux positif : handleBoost n'est pas une ref, c'est une fonction async classique
                    onClick={() => void handleBoost(confirmId)}
                    disabled={boosting !== null}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3 text-sm transition-colors disabled:opacity-60"
                  >
                    {boosting === confirmId
                      ? <i className="fa-solid fa-spinner fa-spin" />
                      : <><i className={`fa-solid ${isProActive ? 'fa-rocket' : 'fa-lock'} text-xs`} />{isProActive ? t('boostListActivateFree') : t('boostListPay')}</>
                    }
                  </button>
                </div>
                {!isProActive && (
                  <p className="text-[10px] text-sub text-center mt-3">{t('boostListPayNote')}</p>
                )}
              </div>
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
  const img      = listing.images?.[0] ?? 'https://via.placeholder.com/600x400?text=AlloAppart';
  const isBoosted = !!listing.boostUntil && new Date(listing.boostUntil) > now;

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col transition ${
      isBoosted ? 'border-gold/40 dark:border-gold/25 bg-gold-pale/20 dark:bg-gold-dark/10' : 'border-line bg-card'
    }`}>
      {/* Image */}
      <div className="relative h-40 shrink-0 overflow-hidden">
        <Image
          src={img}
          alt={listing.title}
          fill
          className="object-cover"
          sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
        />
        <div className="absolute top-2 left-2">
          <BoostStatusBadge boostUntil={listing.boostUntil} t={t} numLocale={numLocale} />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 p-4">
        <Link
          href={`/listings/${listing.id}`}
          className="text-sm font-semibold text-text hover:text-gold-dark transition-colors truncate block"
        >
          {listing.title}
        </Link>
        <p className="mt-1 text-xs text-sub">
          {listing.city} · {typeLabel[listing.type] ?? listing.type}
        </p>
        <p className="mt-1 text-xs font-medium text-text">
          {getListingPriceAmounts(listing)
            .map((e) => `${e.amount.toLocaleString(numLocale)} FCFA${t(e.unit === 'night' ? 'priceUnitNight' : 'priceUnitMonth')}`)
            .join(' · ')}
        </p>
        {listing.boostScore > 0 && (
          <p className="mt-1 text-[11px] text-purple-600 dark:text-purple-400">
            <i className="fa-solid fa-chart-line text-[9px] mr-1" />
            {t('boostScore', { score: listing.boostScore })}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="border-t border-line p-4 pt-3">
        <button
          onClick={onBoost}
          disabled={boosting !== null}
          className={`w-full flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
            isBoosted
              ? 'border border-gold/40 bg-white dark:bg-white/10 text-gold-dark hover:bg-gold-pale dark:hover:bg-gold-dark/20'
              : 'bg-gold text-gray-900 hover:bg-gold-dark'
          }`}
        >
          {boosting === listing.id
            ? <i className="fa-solid fa-spinner fa-spin" />
            : <><i className="fa-solid fa-rocket text-[10px]" />{isBoosted ? t('boostRenew') : t('boostAction')}</>
          }
        </button>
      </div>
    </div>
  );
}
