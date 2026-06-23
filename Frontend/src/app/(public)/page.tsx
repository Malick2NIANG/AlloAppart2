import Link from 'next/link';
import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@clerk/nextjs/server';
import FavoriteButton from '@/components/ui/FavoriteButton';
import { priceToNumber, type Listing, type PaginatedResponse } from '@/types';
import { REGIONS } from '@/lib/regions';

export const revalidate = 3600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function fetchRecentListings(): Promise<Listing[]> {
  try {
    const res = await fetch(`${API_URL}/listings?limit=8&page=1`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json: PaginatedResponse<Listing> = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

function isNewListing(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

const STATS_DATA = [
  { value: '2 400+', key: 'listings' as const, icon: 'fa-solid fa-city'             },
  { value: '14',     key: 'regions'  as const, icon: 'fa-solid fa-map-location-dot' },
  { value: '98%',    key: 'verified' as const, icon: 'fa-solid fa-shield-halved'    },
];

/* ── Page ───────────────────────────────────────────────────────────── */
export default async function HomePage() {
  const [t, locale, listings] = await Promise.all([
    getTranslations('home'),
    getLocale(),
    fetchRecentListings(),
  ]);
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const formatPrice = (n: number | string) =>
    priceToNumber(n).toLocaleString(numLocale) + ' FCFA/' + t('perMonth');

  const { getToken } = await auth();
  const token = await getToken();
  let favoriteIds: string[] = [];
  if (token) {
    try {
      const res = await fetch(`${API_URL}/listings/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const favs = (await res.json()) as { id: string }[];
        favoriteIds = favs.map((f) => f.id);
      }
    } catch {
      favoriteIds = [];
    }
  }

  return (
    <main>

      {/* ══ HÉRO plein-écran ═══════════════════════════════════════════ */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden py-40 md:py-52 px-4 text-center">

        {/* Background animé */}
        <div
          aria-hidden
          className="absolute inset-0 animate-zoomIn bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1571939228382-b2f2b585ce15?auto=format&fit=crop&w=1920&q=80')" }}
        />
        {/* Overlay sombre */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(rgba(0,0,0,0.65), rgba(15,23,42,0.85))' }}
        />

        {/* Contenu */}
        <div className="relative z-10 mx-auto max-w-3xl">

          {/* Badge */}
          <div className="animate-fadeUp mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            {t('badge')}
          </div>

          {/* Titre */}
          <h1 className="animate-fadeUp delay-200 text-5xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
            {t('title1')}
            <span className="mt-1 block bg-linear-to-r from-gold to-gold-light bg-clip-text text-transparent">
              {t('titleGold')}
            </span>
          </h1>

          <p className="animate-fadeUp delay-300 mt-5 text-lg text-gray-300 max-w-xl mx-auto">
            {t('subtitle')}
          </p>

          {/* Barre de recherche héro */}
          <form
            action="/listings"
            method="get"
            className="animate-fadeUp delay-400 mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-white/20 bg-white/10 p-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.30)]"
          >
            {/* Ville */}
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/90 dark:bg-slate-800/90 px-4 py-3">
              <i className="fa-solid fa-location-dot text-gold-dark shrink-0" />
              <input
                name="city"
                type="text"
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchAriaLabel')}
                className="w-full bg-transparent text-sm text-[#1C1C1C] dark:text-white placeholder:text-gray-400 outline-none"
              />
            </div>
            {/* Type */}
            <div className="flex items-center gap-2 rounded-xl bg-white/90 dark:bg-slate-800/90 px-4 py-3 sm:w-44">
              <i className="fa-solid fa-door-open text-gold-dark shrink-0" />
              <select
                name="type"
                aria-label={t('typeLabel')}
                className="w-full bg-transparent text-sm text-[#1C1C1C] dark:text-white outline-none cursor-pointer"
              >
                <option value="">{t('typeLabel')}</option>
                <option value="APPARTEMENT">{t('types.APPARTEMENT')}</option>
                <option value="VILLA">{t('types.VILLA')}</option>
                <option value="STUDIO">{t('types.STUDIO')}</option>
                <option value="CHAMBRE">{t('types.CHAMBRE')}</option>
                <option value="BUREAU">{t('types.BUREAU')}</option>
              </select>
            </div>
            {/* Budget */}
            <div className="flex items-center gap-2 rounded-xl bg-white/90 dark:bg-slate-800/90 px-4 py-3 sm:w-44">
              <i className="fa-solid fa-sack-dollar text-gold-dark shrink-0" />
              <select
                name="budget"
                aria-label={t('budgetLabel')}
                className="w-full bg-transparent text-sm text-[#1C1C1C] dark:text-white outline-none cursor-pointer"
              >
                <option value="">{t('budgetLabel')}</option>
                <option value="100000">100 000 FCFA</option>
                <option value="200000">200 000 FCFA</option>
                <option value="400000">400 000 FCFA</option>
                <option value="700000">700 000 FCFA</option>
              </select>
            </div>
            {/* Bouton */}
            <button type="submit" className="btn-gold gap-2 rounded-xl sm:shrink-0">
              <i className="fa-solid fa-magnifying-glass" />
              {t('searchBtn')}
            </button>
          </form>

          {/* Villes populaires */}
          <div className="animate-fadeUp delay-500 mt-5 flex flex-wrap justify-center gap-2">
            <span className="text-xs text-gray-400">{t('popular')}</span>
            {['Dakar', 'Thiès', 'Saint-Louis', 'Mbour', 'Ziguinchor'].map((c) => (
              <Link
                key={c}
                href={`/listings?city=${c}`}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-gray-300 transition hover:border-gold/50 hover:text-gold"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-softBounce text-gold/70">
          <i className="fa-solid fa-angles-down text-xl" />
        </div>
      </section>

      {/* ══ STATS (cartes sombres) ═════════════════════════════════════ */}
      <section className="bg-dark py-16 px-4">
        <div className="aa-container">
          <div className="grid gap-6 md:grid-cols-3">
            {STATS_DATA.map((s) => (
              <div key={s.key} className="glass-dark text-center">
                <i className={`${s.icon} mb-3 text-2xl text-gold`} />
                <p className="text-3xl font-bold text-gold">{s.value}</p>
                <p className="mt-1 text-sm text-gray-300">{t(`stats.${s.key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ANNONCES ══════════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-bg">
        <div className="aa-container">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-text md:text-4xl">
                {t('recentTitle')}
              </h2>
              <p className="mt-2 text-sub">{t('recentSub')}</p>
            </div>
            <Link
              href="/listings"
              className="btn-outline text-text self-start sm:self-auto whitespace-nowrap"
            >
              {t('seeAll')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sub">
              <i className="fa-solid fa-house-circle-xmark mb-4 text-4xl text-gold/40" />
              <p className="text-sm">{t('noListings')}</p>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {listings.map((l) => (
                <Link key={l.id} href={`/listings/${l.id}`} className="listing-card group block">

                  {/* Image */}
                  <div className="relative h-56 overflow-hidden rounded-t-2xl">
                    {l.images[0] ? (
                      <Image
                        src={l.images[0]}
                        alt={l.title}
                        fill
                        className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,25vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gold-pale">
                        <i className="fa-solid fa-image text-3xl text-gold/40" />
                      </div>
                    )}
                    {/* Overlay gradient */}
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent"
                    />
                    {/* Badge prix */}
                    <span className="absolute bottom-3 left-3 rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                      {formatPrice(l.price)}
                    </span>
                    {/* Badge nouveau */}
                    {isNewListing(l.createdAt) && (
                      <span className="absolute top-3 left-3 rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                        {t('newBadge')}
                      </span>
                    )}
                    {/* Bouton favori */}
                    <FavoriteButton listingId={l.id} initialFavorite={favoriteIds.includes(l.id)} className="absolute top-3 right-3" />
                  </div>

                  {/* Corps */}
                  <div className="p-4">
                    <h3 className="font-semibold text-text line-clamp-1 group-hover:text-gold-dark transition-colors duration-300">{l.title}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-sub">
                      <i className="fa-solid fa-location-dot text-gold-dark text-xs" />
                      {l.city}
                    </p>
                    {l.avgRating != null && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-500 font-medium">
                        <i className="fa-solid fa-star text-[10px]" />
                        <span>{l.avgRating.toFixed(1)}</span>
                        {l._count && (
                          <span className="text-sub font-normal">({l._count.reviews})</span>
                        )}
                      </div>
                    )}
                    {/* Infos */}
                    <div className="mt-3 flex items-center gap-3 text-sm text-sub">
                      {l.beds != null && (
                        <span className="flex items-center gap-1">
                          <i className="fa-solid fa-bed text-gold-dark text-xs" />{l.beds}
                        </span>
                      )}
                      {l.baths != null && (
                        <span className="flex items-center gap-1">
                          <i className="fa-solid fa-bath text-gold-dark text-xs" />{l.baths}
                        </span>
                      )}
                      {l.surface != null && (
                        <span className="flex items-center gap-1">
                          <i className="fa-solid fa-ruler-combined text-gold-dark text-xs" />{l.surface} m²
                        </span>
                      )}
                    </div>
                    {/* Voir plus */}
                    <div className="mt-3 flex items-center gap-1 text-xs text-gold-dark/80 group-hover:text-gold-dark transition-colors duration-300">
                      {t('seeMore')}
                      <svg className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══ RÉGIONS ════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-card">
        <div className="aa-container">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-text md:text-4xl">
                {locale === 'fr' ? 'Explorer par région' : 'Explore by region'}
              </h2>
              <p className="mt-2 text-sub">
                {locale === 'fr' ? '14 régions, des milliers de logements à louer' : '14 regions, thousands of rentals'}
              </p>
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {REGIONS.slice(0, 10).map((r) => (
              <Link
                key={r.slug}
                href={`/regions/${encodeURIComponent(r.slug)}`}
                className="group relative h-32 overflow-hidden rounded-2xl"
               >
                <Image
                  src={r.coverImage}
                  alt={r.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw"
                />
                <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
                <span className="absolute bottom-3 left-3 text-sm font-bold text-white drop-shadow">{r.name}</span>
              </Link>
            ))}
            <Link
              href="/listings"
              className="group relative h-32 overflow-hidden rounded-2xl border border-line bg-bg flex flex-col items-center justify-center gap-1 hover:bg-gold-pale transition"
            >
              <i className="fa-solid fa-map-location-dot text-2xl text-gold-dark group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-text">
                {locale === 'fr' ? 'Voir tout' : 'See all'}
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION PROMO */}
      <section className="bg-dark py-20 px-4">
        <div className="aa-container flex flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
            <i className="fa-solid fa-star" /> Devenez bailleur
          </span>
          <h2 className="max-w-2xl text-3xl font-bold text-white md:text-4xl">
            Mettez votre bien en location
          </h2>
          <p className="mt-4 max-w-xl text-gray-300">Rejoignez des milliers de bailleurs sur Allo-Appart.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/sign-up" className="btn-gold">
              Commencer <i className="fa-solid fa-arrow-right ml-1 text-sm" />
            </Link>
            <Link href="/listings" className="btn-outline text-white">
              Parcourir les annonces
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
