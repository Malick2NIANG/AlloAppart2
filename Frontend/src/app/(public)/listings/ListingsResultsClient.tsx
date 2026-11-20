'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AlloVerifieBadge from '@/components/ui/AlloVerifieBadge';
import { type Listing, getListingPriceAmounts } from '@/types/listing';
import { resolveMiloLocale, getMiloLabels } from '@/components/milo/labels';
import { useNearMe } from '@/components/listings/NearMeContext';
import { getApiBaseUrl } from '@/lib/runtimeUrls';

type ListingWithDistance = Listing & { distanceKm?: number | null };

interface Props {
  initialListings: ListingWithDistance[];
  initialTotal: number;
  favoriteIds: string[];
  perPage: number;
  currentPage: number;
  isFavorisTab: boolean;
  isMilo: boolean;
  miloLang?: string;
  /** Critères de filtre déjà sérialisés (page/limit/lat/lng exclus) — reconstruit
   * la requête Backend du mode « près de moi » et les liens de pagination,
   * sans jamais y ajouter lat/lng à l'URL de LA PAGE (lot « raccourci »,
   * vérif confidentialité : la position reste dans NearMeContext). */
  baseQueryString: string;
}

/**
 * Lot « raccourci » (vérification confidentialité) — extrait de page.tsx :
 * quand « près de moi » est actif (NearMeContext), refait la requête
 * directement depuis le navigateur vers le Backend (même pattern que
 * src/lib/milo.ts : appel direct NAVIGATEUR → Backend, jamais via un route
 * handler Next) avec lat/lng pris en mémoire — jamais dans l'URL de
 * /listings. Sinon, affiche tel quel ce que page.tsx a déjà résolu côté
 * serveur (comportement strictement inchangé).
 */
export default function ListingsResultsClient({
  initialListings, initialTotal, favoriteIds, perPage, currentPage,
  isFavorisTab, isMilo, miloLang, baseQueryString,
}: Props) {
  const t = useTranslations('listings');
  const locale = useLocale() as 'fr' | 'en';
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const { active: nearMeActive, lat, lng } = useNearMe();

  const [override, setOverride] = useState<{ listings: ListingWithDistance[]; total: number } | null>(null);
  const [fetching, setFetching] = useState(false);

  const effectiveActive = nearMeActive && !isFavorisTab && lat != null && lng != null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec le contexte externe NearMeContext, setState après résolution
    if (!effectiveActive) { setOverride(null); return; }
    let cancelled = false;
    setFetching(true);
    const params = new URLSearchParams(baseQueryString);
    params.set('page', String(currentPage));
    params.set('limit', String(perPage));
    params.set('lat', String(lat));
    params.set('lng', String(lng));
    fetch(`${getApiBaseUrl()}/listings?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('listings fetch failed'))))
      .then((data: { data?: ListingWithDistance[]; total?: number }) => {
        if (cancelled) return;
        setOverride({ listings: Array.isArray(data.data) ? data.data : [], total: data.total ?? 0 });
      })
      .catch(() => { if (!cancelled) setOverride({ listings: [], total: 0 }); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [effectiveActive, lat, lng, baseQueryString, currentPage, perPage]);

  const listings = effectiveActive && override ? override.listings : initialListings;
  const total = effectiveActive && override ? override.total : initialTotal;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const pageUrl = (p: number) => {
    const params = new URLSearchParams(baseQueryString);
    params.set('limit', String(perPage));
    params.set('page', String(p));
    return `/listings?${params.toString()}`;
  };
  const perPageUrl = (n: number) => {
    const params = new URLSearchParams(baseQueryString);
    params.set('limit', String(n));
    return `/listings?${params.toString()}`;
  };

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pageNums: number[] = [];
  for (let i = start; i <= end; i++) pageNums.push(i);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  if (effectiveActive && fetching && !override) {
    return (
      <div role="status" aria-busy="true" className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: perPage }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line">
            <div className="aspect-[16/10] w-full animate-pulse bg-line" />
            <div className="space-y-2.5 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded-xl bg-line" />
              <div className="h-3 w-1/2 animate-pulse rounded-xl bg-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-gold-pale grid place-items-center">
          <i className={`fa-solid ${isFavorisTab ? 'fa-heart text-red-300' : 'fa-house-circle-xmark text-gold-dark'} text-2xl`} />
        </div>
        <p className="text-sub">
          {isFavorisTab
            ? t('noFavorites')
            : isMilo
              ? getMiloLabels(resolveMiloLocale(
                  miloLang === 'fr' || miloLang === 'en' || miloLang === 'unsupported' ? miloLang : 'fr',
                  locale,
                )).emptyResultsWithCriteria
              : t('empty')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`grid gap-8 sm:grid-cols-2 ${perPage === 24 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        {listings.map((listing) => {
          const img = listing.images?.[0] ?? 'https://via.placeholder.com/600x400?text=AlloAppart';
          const isNew = (now - new Date(listing.createdAt).getTime()) < 10 * 24 * 60 * 60 * 1000;
          const isAgence = listing.owner?.roles?.includes('PRO_AGENCE') && !!listing.owner.agencySlug;
          const isProAgence = listing.owner?.roles?.includes('PRO_AGENCE');
          const isBoosted = listing.boostUntil && new Date(listing.boostUntil) > new Date(now);

          return (
            <div key={listing.id} className="listing-card group block">
              <Link href={`/listings/${listing.id}`} className="block">
                <div className="relative h-56 overflow-hidden rounded-t-2xl">
                  <Image src={img} alt={listing.title} fill
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" />
                  <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {isBoosted && (
                      <span className="flex items-center gap-1 rounded-full bg-gold text-gray-900 text-[10px] font-bold px-2.5 py-0.5 shadow-sm">
                        <i className="fa-solid fa-bolt text-[9px]" /> En vedette
                      </span>
                    )}
                    {isProAgence && (
                      <span className="flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-sm text-gold text-[10px] font-bold px-2.5 py-0.5">
                        <i className="fa-solid fa-crown text-[9px]" /> {listing.owner?.agencyName ?? 'Agence PRO'}
                      </span>
                    )}
                    {!isBoosted && !isProAgence && isNew && (
                      <span className="rounded-full border border-gold/50 bg-gold-pale px-2.5 py-0.5 text-[10px] font-semibold text-gold-dark">
                        {t('newBadge')}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1">
                    {getListingPriceAmounts(listing).map((e) => (
                      <span key={e.unit} className="rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                        {e.amount.toLocaleString(numLocale)} FCFA{e.unit === 'sale' ? '' : `/${t(e.unit === 'night' ? 'perNight' : 'perMonth')}`}
                      </span>
                    ))}
                  </div>
                  <FavoriteButton listingId={listing.id} initialFavorite={favoriteIds.includes(listing.id)} className="absolute top-3 right-3 max-md:h-11 max-md:w-11" />
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
                    {listing.distanceKm != null && (
                      <span className="ml-1 text-xs text-gold-dark font-medium">
                        · {t('nearMeDistance', { km: listing.distanceKm.toLocaleString(numLocale, { maximumFractionDigits: 1 }) })}
                      </span>
                    )}
                  </p>
                  {listing.tourUrl && (
                    <span className="flex items-center gap-1 text-[10px] font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      <i className="fa-solid fa-cube text-[10px]" aria-hidden="true" /> Visite 3D
                    </span>
                  )}
                  {listing.avgRating != null && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-500 font-medium">
                      <i className="fa-solid fa-star text-[10px]" />
                      <span>{listing.avgRating.toFixed(1)}</span>
                      {listing._count && (
                        <span className="text-sub font-normal">({listing._count.reviews})</span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-sm text-sub">
                    {listing.beds != null && <span className="flex items-center gap-1"><i className="fa-solid fa-bed text-gold-dark text-xs" />{listing.beds}</span>}
                    {listing.baths != null && <span className="flex items-center gap-1"><i className="fa-solid fa-bath text-gold-dark text-xs" />{listing.baths}</span>}
                    {listing.surface != null && <span className="flex items-center gap-1"><i className="fa-solid fa-ruler-combined text-gold-dark text-xs" />{listing.surface} m²</span>}
                    {listing.furnished != null && (
                      <span className="flex items-center gap-1">
                        <i className={`fa-solid ${listing.furnished ? 'fa-couch' : 'fa-box-open'} text-gold-dark text-xs`} />
                        {listing.furnished ? t('furnishedFilterYes') : t('furnishedFilterNo')}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-gold-dark/80 group-hover:text-gold-dark transition-colors duration-300">
                    {t('viewMore')}
                    <svg className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
              {isAgence && (
                <div className="px-4 pb-4 -mt-1">
                  <Link
                    href={`/agences/${listing.owner!.agencySlug!}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-pale px-2.5 py-0.5 text-[11px] font-semibold text-gold-dark hover:bg-gold/20 transition-colors"
                  >
                    {listing.owner!.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.owner!.avatar} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                    )}
                    {!listing.owner!.avatar && <i className="fa-solid fa-building text-[9px]" />}
                    {listing.owner!.agencyName ?? `${listing.owner!.firstName} ${listing.owner!.lastName}`}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-12 flex flex-col items-center gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">

        {total > 6 ? (
          <div className="flex items-center justify-start gap-2 max-lg:order-2 max-lg:justify-center">
            <span className="text-xs text-sub">{t('perPage')}</span>
            <div className="flex items-center gap-1 rounded-full border border-line bg-card p-1">
              {[6, 12, 24].map((n) => (
                <Link
                  key={n}
                  href={perPageUrl(n)}
                  className={`tap-target flex h-7 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                    perPage === n ? 'bg-gold text-gray-900 shadow-sm' : 'text-sub hover:text-gold-dark'
                  }`}
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>
        ) : <div className="hidden lg:block" />}

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-2 max-lg:order-1 max-lg:flex-wrap">
            {currentPage > 1 ? (
              <Link href={pageUrl(currentPage - 1)}
                className="flex h-10 w-10 max-md:h-11 max-md:w-11 items-center justify-center rounded-full border border-line bg-card/80 text-sub hover:bg-gold-pale hover:text-gold-dark transition">
                <i className="fa-solid fa-chevron-left text-xs" />
              </Link>
            ) : (
              <span className="flex h-10 w-10 max-md:h-11 max-md:w-11 items-center justify-center rounded-full border border-line/40 text-sub/30 cursor-not-allowed">
                <i className="fa-solid fa-chevron-left text-xs" />
              </span>
            )}

            <div className="contents max-sm:hidden">
              {start > 1 && (
                <>
                  <Link href={pageUrl(1)} className="flex h-10 w-10 max-md:h-11 max-md:w-11 items-center justify-center rounded-full border border-line bg-card/80 text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">1</Link>
                  {start > 2 && <span className="text-sub px-1">…</span>}
                </>
              )}
              {pageNums.map((p) => (
                <Link key={p} href={pageUrl(p)}
                  className={`flex h-10 w-10 max-md:h-11 max-md:w-11 items-center justify-center rounded-full border text-sm font-medium transition ${
                    p === currentPage
                      ? 'border-gold bg-gold text-gray-900 shadow-sm'
                      : 'border-line bg-card/80 text-text hover:bg-gold-pale hover:text-gold-dark'
                  }`}>
                  {p}
                </Link>
              ))}
              {end < totalPages && (
                <>
                  {end < totalPages - 1 && <span className="text-sub px-1">…</span>}
                  <Link href={pageUrl(totalPages)} className="flex h-10 w-10 max-md:h-11 max-md:w-11 items-center justify-center rounded-full border border-line bg-card/80 text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">{totalPages}</Link>
                </>
              )}
            </div>

            <span aria-live="polite" className="sm:hidden flex h-11 min-w-24 items-center justify-center rounded-full border border-gold/40 bg-gold-pale px-4 text-sm font-semibold text-gold-dark">
              {currentPage} / {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link href={pageUrl(currentPage + 1)}
                className="flex h-10 w-10 max-md:h-11 max-md:w-11 items-center justify-center rounded-full border border-line bg-card/80 text-sub hover:bg-gold-pale hover:text-gold-dark transition">
                <i className="fa-solid fa-chevron-right text-xs" />
              </Link>
            ) : (
              <span className="flex h-10 w-10 max-md:h-11 max-md:w-11 items-center justify-center rounded-full border border-line/40 text-sub/30 cursor-not-allowed">
                <i className="fa-solid fa-chevron-right text-xs" />
              </span>
            )}
          </div>
        ) : <div className="hidden lg:block" />}

        <div className="hidden lg:block" />
      </div>
    </>
  );
}
