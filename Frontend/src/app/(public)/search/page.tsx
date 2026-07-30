import { getTranslations, getLocale } from 'next-intl/server';
import { api } from '@/lib/api';
import { type Listing, priceToNumber } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import AlloVerifieBadge from '@/components/ui/AlloVerifieBadge';

interface SearchResult {
  hits: Listing[];
  estimatedTotalHits: number;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const t = await getTranslations('search');
  const locale = await getLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-SN';

  let hits: Listing[] = [];
  let total = 0;
  if (q) {
    try {
      const result = await api.get<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
      hits = result.hits ?? [];
      total = result.estimatedTotalHits ?? hits.length;
    } catch {
      hits = [];
    }
  }

  return (
    <main className="bg-bg min-h-screen">
      <div className="aa-container py-10">
        <h1 className="mb-6 text-2xl font-extrabold text-text">{t('title')}</h1>

        <form method="GET" className="mb-8 flex gap-3">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
            <input
              name="q"
              defaultValue={q}
              placeholder={t('placeholder')}
              className="w-full rounded-2xl border border-line bg-card py-3 pl-10 pr-4 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition"
            />
          </div>
          <button
            type="submit"
            className="btn-gold rounded-2xl px-6 text-sm font-semibold"
          >
            {t('searchBtn')}
          </button>
        </form>

        {q && (
          <p className="mb-6 text-sm text-sub">
            {total > 0 ? (
              t('resultsFor', { count: total, q })
            ) : (
              t('noResultsFor', { q })
            )}
          </p>
        )}

        {hits.length === 0 && q && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
              <i className="fa-solid fa-magnifying-glass text-2xl text-gold-dark" />
            </div>
            <p className="font-semibold text-text">{t('noResultsTitle')}</p>
            <p className="mt-1 text-sm text-sub">{t('noResultsHint')}</p>
            <Link
              href="/listings"
              className="btn-gold mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              <i className="fa-solid fa-list" /> {t('viewAllListings')}
            </Link>
          </div>
        )}

        {!q && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
              <i className="fa-solid fa-magnifying-glass text-2xl text-gold-dark" />
            </div>
            <p className="font-semibold text-text">{t('startSearchTitle')}</p>
            <p className="mt-1 text-sm text-sub">{t('startSearchHint')}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hits.map((listing) => (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="group overflow-hidden rounded-2xl border border-line bg-card shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <div className="relative h-48 overflow-hidden bg-gold-pale">
                {listing.images?.[0] ? (
                  <Image
                    src={listing.images[0]}
                    alt={listing.title}
                    fill
                    className="object-cover group-hover:scale-105 transition duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <i className="fa-solid fa-image text-3xl text-sub/30" />
                  </div>
                )}
                {listing.isVerified && (
                  <AlloVerifieBadge className="absolute left-3 top-3 shadow-sm" />
                )}
              </div>
              <div className="p-4">
                <p className="truncate font-semibold text-text">{listing.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-sub">
                  <i className="fa-solid fa-location-dot text-xs text-gold-dark" />
                  {listing.city}
                </p>
                <p className="mt-3 font-extrabold text-gold-dark">
                  {priceToNumber(listing.price).toLocaleString(numLocale)}
                  <span className="ml-1 text-xs font-semibold text-sub">
                    {t('priceUnit')}/{t('pricePerMonth')}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
