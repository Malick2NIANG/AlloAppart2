import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@clerk/nextjs/server';
import ListingsFilters from './ListingsFilters';
import ListingsResultsClient from './ListingsResultsClient';
import { type Listing, type ListingsResponse } from '@/types/listing';

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; city?: string; type?: string; q?: string; minPrice?: string; maxPrice?: string;
    region?: string; limit?: string; tab?: string; ownerType?: string; verified?: string; transactionType?: string;
    // Lot 5b — paramètres produits par Milo (jamais exposés par les filtres
    // manuels avant ce lot) : cityContains, minBeds/maxBeds, minRooms/maxRooms,
    // amenities (CSV). milo/miloLang/miloMiss pilotent le message « vide ».
    cityContains?: string; minBeds?: string; maxBeds?: string; minRooms?: string; maxRooms?: string;
    amenities?: string; milo?: string; miloLang?: string; miloMiss?: string; miloText?: string; miloUnmatched?: string;
    // Lot 6a — préférences floues (classent, n'excluent jamais).
    prefs?: string;
    // Lot meublé/durée — filtres manuels (type de location, ameublement, prix
    // par nuit, qui remplace le prix mensuel quand rentalMode=NIGHTLY).
    rentalMode?: string; furnished?: string; minPricePerNight?: string; maxPricePerNight?: string;
  }>;
}) {
  const {
    page = '1', city, type, q, minPrice, maxPrice, region, limit: limitParam, tab, ownerType, verified,
    transactionType: rawTransactionType, cityContains, minBeds, maxBeds, minRooms, maxRooms, amenities,
    milo, miloLang, miloMiss, miloText, miloUnmatched, prefs,
    rentalMode, furnished, minPricePerNight, maxPricePerNight,
  } = await searchParams;
  const transactionType = rawTransactionType === 'LOCATION' || rawTransactionType === 'VENTE' ? rawTransactionType : undefined;
  const isMilo = milo === '1';
  const isFavorisTab = tab === 'favoris';
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage     = [6, 12, 24].includes(parseInt(limitParam ?? '', 10)) ? parseInt(limitParam!, 10) : 6;
  const [t, locale] = await Promise.all([getTranslations('listings'), getLocale()]);

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
  let prefsMatched: boolean | undefined;

  if (isFavorisTab) {
    // L'API renvoie tous les favoris d'un coup : on pagine ici.
    total = favoriteListings.length;
    listings = favoriteListings.slice((currentPage - 1) * perPage, currentPage * perPage);
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
        ...(transactionType ? { transactionType } : {}),
        ...(verified  ? { isVerified: 'true' }   : {}),
        ...(cityContains ? { cityContains }      : {}),
        ...(minBeds   ? { minBeds }              : {}),
        ...(maxBeds   ? { maxBeds }              : {}),
        ...(minRooms  ? { minRooms }             : {}),
        ...(maxRooms  ? { maxRooms }             : {}),
        ...(amenities ? { amenities }            : {}),
        ...(prefs     ? { prefs }                : {}),
        ...(rentalMode ? { rentalMode }          : {}),
        ...(furnished  ? { furnished }           : {}),
        ...(minPricePerNight ? { minPricePerNight } : {}),
        ...(maxPricePerNight ? { maxPricePerNight } : {}),
      });
      const res = await api.get<ListingsResponse>(`/listings?${params}`);
      listings = Array.isArray(res?.data) ? res.data : [];
      total = res.total ?? 0;
      prefsMatched = res.prefsMatched;
    } catch {
      listings = [];
      total = 0;
    }
  }

  // Filtres communs à pageUrl/perPageUrl/baseQueryString — inclut les
  // paramètres Milo (lot 5b) pour que changer de page ou de taille de page
  // ne fasse pas perdre le bandeau « Milo a compris » / les pastilles. Ne
  // contient JAMAIS lat/lng (lot « raccourci », vérif confidentialité : la
  // position vit dans NearMeContext, jamais dans l'URL de /listings — voir
  // ListingsResultsClient.tsx, qui refait sa propre requête directement
  // vers le Backend quand « près de moi » est actif).
  const baseParams = () => {
    const params = new URLSearchParams();
    if (isFavorisTab) params.set('tab', 'favoris');
    if (q)         params.set('q', q);
    if (city)      params.set('city', city);
    if (type)      params.set('type', type);
    if (minPrice)  params.set('minPrice', minPrice);
    if (maxPrice)  params.set('maxPrice', maxPrice);
    if (region)    params.set('region', region);
    if (ownerType) params.set('ownerType', ownerType);
    if (transactionType) params.set('transactionType', transactionType);
    if (verified)  params.set('verified', verified);
    if (cityContains) params.set('cityContains', cityContains);
    if (minBeds)   params.set('minBeds', minBeds);
    if (maxBeds)   params.set('maxBeds', maxBeds);
    if (minRooms)  params.set('minRooms', minRooms);
    if (maxRooms)  params.set('maxRooms', maxRooms);
    if (amenities) params.set('amenities', amenities);
    if (prefs)     params.set('prefs', prefs);
    if (rentalMode) params.set('rentalMode', rentalMode);
    if (furnished)  params.set('furnished', furnished);
    if (minPricePerNight) params.set('minPricePerNight', minPricePerNight);
    if (maxPricePerNight) params.set('maxPricePerNight', maxPricePerNight);
    if (isMilo)    params.set('milo', '1');
    if (miloLang)  params.set('miloLang', miloLang);
    if (miloText)  params.set('miloText', miloText);
    if (miloUnmatched) params.set('miloUnmatched', miloUnmatched);
    if (miloMiss)  params.set('miloMiss', miloMiss);
    return params;
  };

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
              className={`flex max-md:min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
              className={`flex max-md:min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isFavorisTab
                  ? 'border-red-500 text-red-500'
                  : 'border-transparent text-sub hover:text-text'
              }`}
            >
              <i className={`fa-heart text-xs ${isFavorisTab ? 'fa-solid' : 'fa-regular'}`} />
              Mes favoris
              {favoriteIds.length > 0 && (
                <span className="rounded-full bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  {favoriteIds.length}
                </span>
              )}
            </Link>
          </div>
        )}

        {/* Filtres : transaction, région, panneau Filtres, types, filtres actifs
            (onglet Toutes uniquement) */}
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
            rentalMode={rentalMode}
            furnished={furnished}
            minPricePerNight={minPricePerNight}
            maxPricePerNight={maxPricePerNight}
            prefsMatched={prefsMatched}
          />
        )}

        <ListingsResultsClient
          initialListings={listings}
          initialTotal={total}
          favoriteIds={favoriteIds}
          perPage={perPage}
          currentPage={currentPage}
          isFavorisTab={isFavorisTab}
          isMilo={isMilo}
          miloLang={miloLang}
          baseQueryString={baseParams().toString()}
        />
      </div>
    </main>
  );
}
