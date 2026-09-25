'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { getListingPriceAmounts } from '@/types';
import type { Listing } from '@/types';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import AlloVerifieBadge from '@/components/ui/AlloVerifieBadge';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';
import { BookingSearchRow } from '@/components/bookings/BookingSearchRow';
import { BookingPagination } from '@/components/bookings/BookingPagination';

type FavFilter = 'ALL' | 'VERIFIED' | 'NIGHTLY' | 'MONTHLY';
const PER_PAGE_OPTIONS = [6, 9, 12] as const;

export default function FavoritesPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const t = useTranslations('locataire');
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [filter, setFilter] = useState<FavFilter>('ALL');
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState<number>(PER_PAGE_OPTIONS[1]);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getToken().then((token) => {
      if (!token) { setLoading(false); return; }
      api.get<Listing[]>('/listings/favorites', token)
        .then(setFavorites)
        .catch(() => setError(t('favoritesError')))
        .finally(() => setLoading(false));
    });
  }, [getToken, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial, setState après résolution async
  useEffect(() => { load(); }, [load]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination suite à un changement de filtre/recherche/taille de page
  useEffect(() => { setPage(1); }, [filter, search, perPage]);

  const remove = async (listingId: string) => {
    const token = await getToken();
    if (!token) return;
    setRemoving(listingId);
    try {
      await api.delete(`/listings/${listingId}/favorite`, token);
      setFavorites((prev) => prev.filter((f) => f.id !== listingId));
      toast.success(t('removedFromFavorites'));
    } catch {
      toast.error(t('removeError'));
    } finally {
      setRemoving(null);
    }
  };

  const counts = useMemo(() => ({
    ALL:      favorites.length,
    VERIFIED: favorites.filter((l) => l.isVerified).length,
    NIGHTLY:  favorites.filter((l) => l.rentalMode === 'NIGHTLY' || l.rentalMode === 'MIXED').length,
    MONTHLY:  favorites.filter((l) => l.rentalMode === 'MONTHLY' || l.rentalMode === 'MIXED').length,
  }), [favorites]);

  const byCategory = useMemo(() => favorites.filter((l) => {
    if (filter === 'VERIFIED') return l.isVerified;
    if (filter === 'NIGHTLY')  return l.rentalMode === 'NIGHTLY' || l.rentalMode === 'MIXED';
    if (filter === 'MONTHLY')  return l.rentalMode === 'MONTHLY' || l.rentalMode === 'MIXED';
    return true;
  }), [favorites, filter]);

  const q = search.trim().toLowerCase();
  const filtered = byCategory.filter((l) =>
    !q || l.title.toLowerCase().includes(q) || l.city.toLowerCase().includes(q),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage  = Math.min(page, pageCount);
  const visible   = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text">{t('favoritesTitle')}</h1>
          <p className="mt-1 text-sm text-sub">{t('favoritesLoading')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height="320px" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={load} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />{t('retryBtn')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">{t('favoritesTitle')}</h1>
        <p className="mt-1 text-sm text-sub">
          {t('favoritesCount', { count: favorites.length })}
        </p>
      </div>

      <>
          {/* Cartes stats / filtres — toujours visibles, même à 0, pour
              rester cohérent avec AlloVérifié/boost/bookings. */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatFilterCard
              icon="fa-heart" label={t('favoritesFilterAll')} value={counts.ALL}
              color="text-gold-dark" bg="bg-gold-pale"
              active={filter === 'ALL'} onClick={() => setFilter('ALL')}
              selectedLabel={t('filterSelected')}
            />
            <StatFilterCard
              icon="fa-shield-halved" label={t('favoritesFilterVerified')} value={counts.VERIFIED}
              color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-950/30"
              active={filter === 'VERIFIED'} onClick={() => setFilter('VERIFIED')}
              selectedLabel={t('filterSelected')}
            />
            <StatFilterCard
              icon="fa-moon" label={t('favoritesFilterNightly')} value={counts.NIGHTLY}
              color="text-blue-500 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/30"
              active={filter === 'NIGHTLY'} onClick={() => setFilter('NIGHTLY')}
              selectedLabel={t('filterSelected')}
            />
            <StatFilterCard
              icon="fa-calendar-days" label={t('favoritesFilterMonthly')} value={counts.MONTHLY}
              color="text-purple-500 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-950/30"
              active={filter === 'MONTHLY'} onClick={() => setFilter('MONTHLY')}
              selectedLabel={t('filterSelected')}
            />
          </div>

          {/* Recherche + lignes par page */}
          <BookingSearchRow
            search={search} onSearchChange={setSearch} searchPlaceholder={t('searchPlaceholder')}
            perPage={perPage} onPerPageChange={setPerPage} perPageOptions={PER_PAGE_OPTIONS}
            rowsLabel={t('rowsLabel')}
          />

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-sub">
                {favorites.length === 0 ? t('noFavoritesHint') : t('favoritesNoResults')}
              </p>
              {favorites.length === 0 && (
                <Link href="/listings" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                  <i className="fa-solid fa-magnifying-glass text-xs" /> {t('browseBtn')}
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visible.map((listing) => {
                  const isBoosted = listing.boostUntil && new Date(listing.boostUntil) > new Date();
                  const img = listing.images[0] ?? 'https://via.placeholder.com/600x400?text=AlloAppart';
                  return (
                    // Même gabarit que (public)/listings et l'accueil
                    // (.listing-card, image h-56, badges/prix en overlay,
                    // AlloVerifieBadge) — seul le bouton cœur (retrait
                    // immédiat de la liste + toast) est spécifique à cette page.
                    <div key={listing.id} className="listing-card group flex flex-col">
                      <Link href={`/listings/${listing.id}`} className="block">
                        <div className="relative h-56 overflow-hidden rounded-t-2xl">
                          <Image
                            src={img}
                            alt={listing.title}
                            fill
                            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                            sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
                          />
                          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                          {isBoosted && (
                            <div className="absolute top-3 left-3">
                              <span className="flex items-center gap-1 rounded-full bg-gold text-gray-900 text-[10px] font-bold px-2.5 py-0.5 shadow-sm">
                                <i className="fa-solid fa-bolt text-[9px]" /> {t('featuredBadge')}
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1">
                            {getListingPriceAmounts(listing).map((e) => (
                              <span key={e.unit} className="rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                                {e.amount.toLocaleString('fr-FR')} FCFA/{t(e.unit === 'night' ? 'perNight' : 'perMonth')}
                              </span>
                            ))}
                          </div>
                          {/* Retrait des favoris — retrait immédiat de la liste (voir remove()) */}
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void remove(listing.id); }}
                            disabled={removing === listing.id}
                            aria-label={t('removedFromFavorites')}
                            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 transition-all duration-300 hover:bg-gold-pale disabled:opacity-70"
                          >
                            {removing === listing.id
                              ? <i className="fa-solid fa-spinner fa-spin text-sm text-sub" />
                              : <i className="fa-solid fa-heart text-sm text-gold-dark" />
                            }
                          </button>
                        </div>

                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-text line-clamp-1 group-hover:text-gold-dark transition-colors duration-300">
                              {listing.title}
                            </h3>
                            {listing.isVerified && <AlloVerifieBadge size="sm" className="shrink-0 mt-0.5" />}
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-sm text-sub">
                            <i className="fa-solid fa-location-dot text-gold-dark text-xs" />{listing.city}
                          </p>
                          <div className="mt-3 flex items-center gap-3 text-sm text-sub">
                            {listing.beds    && <span className="flex items-center gap-1"><i className="fa-solid fa-bed text-gold-dark text-xs" />{listing.beds}</span>}
                            {listing.baths   && <span className="flex items-center gap-1"><i className="fa-solid fa-bath text-gold-dark text-xs" />{listing.baths}</span>}
                            {listing.surface && <span className="flex items-center gap-1"><i className="fa-solid fa-ruler-combined text-gold-dark text-xs" />{listing.surface} m²</span>}
                          </div>
                          <div className="mt-3 flex items-center gap-1 text-xs text-gold-dark/80 group-hover:text-gold-dark transition-colors duration-300">
                            {t('viewBtn')}
                            <svg className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>

              <BookingPagination
                page={safePage} pageCount={pageCount} onPageChange={setPage}
                previousLabel={t('previous')} nextLabel={t('next')}
                pageOfLabel={t('pageOf', { page: safePage, total: pageCount })}
              />
            </>
          )}
        </>
    </div>
  );
}
