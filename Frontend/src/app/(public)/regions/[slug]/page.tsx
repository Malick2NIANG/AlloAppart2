import Link from 'next/link';
import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@clerk/nextjs/server';
import FavoriteButton from '@/components/ui/FavoriteButton';
import { MOCK_LISTINGS } from '@/lib/mockListings';
import type { Listing } from '@/types';

const PER_PAGE = 6;

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, { page = '1' }] = await Promise.all([params, searchParams]);
  const region = decodeURIComponent(slug);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const [t, locale] = await Promise.all([getTranslations('region'), getLocale()]);
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  let listings: Listing[] = [];
  let total = 0;
  try {
    const { api } = await import('@/lib/api');
    const res = await api.get<{ data: Listing[]; total: number }>(
      `/listings?region=${encodeURIComponent(region)}&page=${currentPage}&limit=${PER_PAGE}`
    );
    if (!Array.isArray(res?.data) || res.data.length === 0) throw new Error('empty');
    listings = res.data;
    total = res.total ?? 0;
  } catch {
    const filtered = (MOCK_LISTINGS as unknown as Listing[]).filter(
      (l) => l.region.toLowerCase() === region.toLowerCase()
    );
    total = filtered.length;
    listings = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  }

  const { getToken } = await auth();
  const token = await getToken();
  let favoriteIds: string[] = [];
  if (token) {
    try {
      const { api } = await import('@/lib/api');
      const favs = await api.get<{ id: string }[]>('/listings/favorites', token);
      favoriteIds = favs.map((f) => f.id);
    } catch {
      favoriteIds = [];
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const pageUrl = (p: number) => `/regions/${encodeURIComponent(slug)}?page=${p}`;

  const pageNums: number[] = [];
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pageNums.push(i);

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-sub mb-3">
            <Link href="/" className="hover:text-gold-dark transition-colors">{locale === 'fr' ? 'Accueil' : 'Home'}</Link>
            <i className="fa-solid fa-chevron-right text-xs" />
            <Link href="/listings" className="hover:text-gold-dark transition-colors">
              {locale === 'fr' ? 'Annonces' : 'Listings'}
            </Link>
            <i className="fa-solid fa-chevron-right text-xs" />
            <span className="text-text font-medium">{region}</span>
          </div>
          <h1 className="text-3xl font-bold text-text">{t('title')} {region}</h1>
          <p className="mt-1 text-sm text-sub">
            {total} {total <= 1 ? t('countOne') : t('countMany')}
          </p>
        </div>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-gold-pale grid place-items-center">
              <i className="fa-solid fa-house-circle-xmark text-2xl text-gold-dark" />
            </div>
            <p className="text-sub">{t('empty')}</p>
            <Link href="/listings" className="btn-gold px-5 py-2.5 rounded-full text-sm font-semibold">
              {locale === 'fr' ? 'Voir toutes les annonces' : 'See all listings'}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
              {listings.map((listing) => {
                const img = listing.images?.[0] ?? 'https://via.placeholder.com/600x400?text=AlloAppart';
                const isNew = (now - new Date(listing.createdAt).getTime()) < 10 * 24 * 60 * 60 * 1000;

                return (
                  <Link key={listing.id} href={`/listings/${listing.id}`} className="listing-card group block">
                    <div className="relative h-56 overflow-hidden rounded-t-2xl">
                      <Image
                        src={img}
                        alt={listing.title}
                        fill
                        className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
                      />
                      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                      <span className="absolute bottom-3 left-3 rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                        {listing.price.toLocaleString(numLocale)} FCFA/{t('perMonth')}
                      </span>
                      {isNew && (
                        <span className="absolute top-3 left-3 rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                          {locale === 'fr' ? 'Nouveau' : 'New'}
                        </span>
                      )}
                      <FavoriteButton listingId={listing.id} initialFavorite={favoriteIds.includes(listing.id)} className="absolute top-3 right-3" />
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-text line-clamp-1 group-hover:text-gold-dark transition-colors duration-300">
                        {listing.title}
                      </h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-sub">
                        <i className="fa-solid fa-location-dot text-gold-dark text-xs" />{listing.city}
                      </p>
                      {listing.isVerified && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                          <i className="fa-solid fa-shield-halved" />{locale === 'fr' ? 'AlloVérifié' : 'AlloVerified'}
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
                        {locale === 'fr' ? 'Voir plus' : 'View more'}
                        <svg className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
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
