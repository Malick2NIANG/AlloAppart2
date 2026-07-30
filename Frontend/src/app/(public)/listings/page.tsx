import Link from 'next/link';
import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@clerk/nextjs/server';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AlloVerifieBadge from '@/components/ui/AlloVerifieBadge';
import ListingsFilters from './ListingsFilters';
import { type Listing, type ListingsResponse, priceToNumber } from '@/types/listing';

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; city?: string; type?: string; q?: string; minPrice?: string; maxPrice?: string; region?: string; limit?: string; tab?: string; ownerType?: string; verified?: string }>;
}) {
  const { page = '1', city, type, q, minPrice, maxPrice, region, limit: limitParam, tab, ownerType, verified } = await searchParams;
  const isFavorisTab = tab === 'favoris';
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage     = [6, 12, 24].includes(parseInt(limitParam ?? '', 10)) ? parseInt(limitParam!, 10) : 6;
  const [t, locale] = await Promise.all([getTranslations('listings'), getLocale()]);
  const numLocale   = locale === 'en' ? 'en-US' : 'fr-FR';

  const { getToken, userId } = await auth();
  const token = await getToken();
  let favoriteIds: string[] = [];
  let favoriteListings: Listing[] = [];

  if (token) {
    try {
      const { api } = await import('@/lib/api');
      if (isFavorisTab) {
        favoriteListings = await api.get<Listing[]>('/listings/favorites', token);
        favoriteIds = favoriteListings.map((f) => f.id);
      } else {
        const favs = await api.get<{ id: string }[]>('/listings/favorites', token);
        favoriteIds = favs.map((f) => f.id);
      }
    } catch {
      favoriteIds = [];
    }
  }

  let listings: Listing[] = [];
  let total = 0;

  if (isFavorisTab) {
    listings = favoriteListings;
    total = favoriteListings.length;
  } else {
    try {
      const { api } = await import('@/lib/api');
      const params = new URLSearchParams({
        page: String(currentPage), limit: String(perPage),
        ...(city      ? { city }                 : {}),
        ...(type      ? { type }                 : {}),
        ...(q         ? { q }                    : {}),
        ...(minPrice  ? { minPrice }             : {}),
        ...(maxPrice  ? { maxPrice }             : {}),
        ...(region    ? { region }               : {}),
        ...(ownerType ? { ownerType }            : {}),
        ...(verified  ? { isVerified: 'true' }   : {}),
      });
      const res = await api.get<ListingsResponse>(`/listings?${params}`);
      listings = Array.isArray(res?.data) ? res.data : [];
      total = res.total ?? 0;
    } catch {
      listings = [];
      total = 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const pageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (q)         params.set('q', q);
    if (city)      params.set('city', city);
    if (type)      params.set('type', type);
    if (minPrice)  params.set('minPrice', minPrice);
    if (maxPrice)  params.set('maxPrice', maxPrice);
    if (region)    params.set('region', region);
    if (ownerType) params.set('ownerType', ownerType);
    if (verified)  params.set('verified', verified);
    params.set('limit', String(perPage));
    params.set('page', String(p));
    return `/listings?${params.toString()}`;
  };

  const pageNums: number[] = [];
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end   = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pageNums.push(i);

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text">
            {ownerType === 'AGENCE'
              ? 'Annonces d\'agences'
              : ownerType === 'PARTICULIER'
              ? 'Annonces de particuliers'
              : t('title')}
          </h1>
          <p className="mt-1 text-sm text-sub">
            {total} {total <= 1 ? t('countOne') : t('countMany')}
          </p>
        </div>

        {/* Onglets */}
        {userId && (
          <div className="mb-6 flex gap-1 border-b border-line">
            <Link
              href="/listings"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                !isFavorisTab
                  ? 'border-gold-dark text-gold-dark'
                  : 'border-transparent text-sub hover:text-text'
              }`}
            >
              <i className="fa-solid fa-list-ul text-xs" />
              Toutes les annonces
            </Link>
            <Link
              href="/listings?tab=favoris"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isFavorisTab
                  ? 'border-red-500 text-red-500'
                  : 'border-transparent text-sub hover:text-text'
              }`}
            >
              <i className={`fa-heart text-xs ${isFavorisTab ? 'fa-solid' : 'fa-regular'}`} />
              Mes favoris
              {favoriteIds.length > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                  {favoriteIds.length}
                </span>
              )}
            </Link>
          </div>
        )}

        {/* Filtres (onglet Toutes uniquement) */}
        {!isFavorisTab && (
          <ListingsFilters
            type={type}
            region={region}
            q={q}
            city={city}
            minPrice={minPrice}
            maxPrice={maxPrice}
            ownerType={ownerType}
            limit={perPage}
            locale={locale}
          />
        )}

        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-gold-pale grid place-items-center">
              <i className={`fa-solid ${isFavorisTab ? 'fa-heart text-red-300' : 'fa-house-circle-xmark text-gold-dark'} text-2xl`} />
            </div>
            <p className="text-sub">
              {isFavorisTab ? t('noFavorites') : t('empty')}
            </p>
          </div>
        ) : (
          <>
            <div className={`grid gap-8 sm:grid-cols-2 ${perPage === 24 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {listings.map((listing) => {
                const img = listing.images?.[0] ?? 'https://via.placeholder.com/600x400?text=AlloAppart';
                const isNew      = (now - new Date(listing.createdAt).getTime()) < 10 * 24 * 60 * 60 * 1000;
                const isAgence   = listing.owner?.roles?.includes('PRO_AGENCE') && !!listing.owner.agencySlug;
                const isProAgence = listing.owner?.roles?.includes('PRO_AGENCE');
                const isBoosted  = listing.boostUntil && new Date(listing.boostUntil) > new Date(now);

                return (
                  <div key={listing.id} className="listing-card group block">
                    <Link href={`/listings/${listing.id}`} className="block">
                      <div className="relative h-56 overflow-hidden rounded-t-2xl">
                        <Image src={img} alt={listing.title} fill
                          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                          sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" />
                        <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                        {/* Badges haut gauche */}
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
                        <span className="absolute bottom-3 left-3 rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                          {priceToNumber(listing.price).toLocaleString(numLocale)} FCFA/{t('perMonth')}
                        </span>
                        <FavoriteButton listingId={listing.id} initialFavorite={favoriteIds.includes(listing.id)} className="absolute top-3 right-3" />
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
                        {listing.tourUrl && (
                          <span className="flex items-center gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
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
                          <span className="flex items-center gap-1"><i className="fa-solid fa-bed text-gold-dark text-xs" />{listing.beds}</span>
                          <span className="flex items-center gap-1"><i className="fa-solid fa-bath text-gold-dark text-xs" />{listing.baths}</span>
                          <span className="flex items-center gap-1"><i className="fa-solid fa-ruler-combined text-gold-dark text-xs" />{listing.surface} m²</span>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-xs text-gold-dark/80 group-hover:text-gold-dark transition-colors duration-300">
                          {t('viewMore')}
                          <svg className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                    {/* Badge agence — hors du Link card pour éviter <a> dans <a> */}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">

                {currentPage > 1 ? (
                  <Link href={pageUrl(currentPage - 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/80 text-sub hover:bg-gold-pale hover:text-gold-dark transition">
                    <i className="fa-solid fa-chevron-left text-xs" />
                  </Link>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line/40 text-sub/30 cursor-not-allowed">
                    <i className="fa-solid fa-chevron-left text-xs" />
                  </span>
                )}

                {start > 1 && (
                  <>
                    <Link href={pageUrl(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/80 text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">1</Link>
                    {start > 2 && <span className="text-sub px-1">…</span>}
                  </>
                )}

                {pageNums.map((p) => (
                  <Link key={p} href={pageUrl(p)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition ${
                      p === currentPage
                        ? 'border-gold bg-gold text-gray-900 shadow-sm'
                        : 'border-line bg-white/80 text-text hover:bg-gold-pale hover:text-gold-dark'
                    }`}>
                    {p}
                  </Link>
                ))}

                {end < totalPages && (
                  <>
                    {end < totalPages - 1 && <span className="text-sub px-1">…</span>}
                    <Link href={pageUrl(totalPages)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/80 text-sm text-text hover:bg-gold-pale hover:text-gold-dark transition">{totalPages}</Link>
                  </>
                )}

                {currentPage < totalPages ? (
                  <Link href={pageUrl(currentPage + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/80 text-sub hover:bg-gold-pale hover:text-gold-dark transition">
                    <i className="fa-solid fa-chevron-right text-xs" />
                  </Link>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line/40 text-sub/30 cursor-not-allowed">
                    <i className="fa-solid fa-chevron-right text-xs" />
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
