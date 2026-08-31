import Link from 'next/link';
import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@clerk/nextjs/server';
import FavoriteButton from '@/components/ui/FavoriteButton';
import GreetingHero from '@/components/ui/GreetingHero';
import GreetingCTA from '@/components/ui/GreetingCTA';
import { priceToNumber, type Listing, type PaginatedResponse } from '@/types';
import { REGIONS } from '@/lib/regions';

export const revalidate = 300; // fallback 5 min — invalidation immédiate via /api/revalidate

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

interface AgencyCard {
  id: string;
  agencyName?: string | null;
  firstName: string;
  lastName: string;
  agencySlug?: string | null;
  avatar?: string | null;
  bio?: string | null;
  _count: { listings: number };
  subscription?: { plan: string; status: string } | null;
}

async function fetchAgencies(): Promise<AgencyCard[]> {
  try {
    const res = await fetch(`${API_URL}/agences`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json() as Promise<AgencyCard[]>;
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
  const [t, locale, listings, agencies] = await Promise.all([
    getTranslations('home'),
    getLocale(),
    fetchRecentListings(),
    fetchAgencies(),
  ]);
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const formatPrice = (n: number | string) =>
    priceToNumber(n).toLocaleString(numLocale) + ' FCFA/' + t('perMonth');

  const { getToken } = await auth();
  const token = await getToken();

  // Récupère rôles + prénom en parallèle avec les favoris
  let favoriteIds: string[] = [];
  let userRoles: string[]   = [];
  let firstName             = '';

  if (token) {
    const [favsRes, meRes] = await Promise.allSettled([
      fetch(`${API_URL}/listings/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 0 },
      }),
      fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 60 },
      }),
    ]);

    if (favsRes.status === 'fulfilled' && favsRes.value.ok) {
      const favs = (await favsRes.value.json()) as { id: string }[];
      favoriteIds = favs.map((f) => f.id);
    }
    if (meRes.status === 'fulfilled' && meRes.value.ok) {
      const me = (await meRes.value.json()) as { roles: string[]; firstName?: string };
      userRoles = me.roles ?? [];
      firstName = me.firstName ?? '';
    }
  }

  const isAdmin       = userRoles.includes('ADMIN');
  const isBailleur    = userRoles.some((r) => ['BAILLEUR', 'PRO_AGENCE'].includes(r));
  const isProAgence   = userRoles.includes('PRO_AGENCE');
  const isAgentTerrain = userRoles.includes('AGENT_TERRAIN');
  const isLocataire   = !isAdmin && !isBailleur && !isAgentTerrain && token !== null;

  return (
    <main>

      {/* ══ HÉRO plein-écran ═══════════════════════════════════════════ */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden py-40 md:py-52 px-4 text-center">

        {/* Background animé */}
        <div
          aria-hidden
          className="absolute inset-0 animate-zoomIn bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1681225241052-ac67808b0c62?auto=format&fit=crop&w=1920&q=80')" }}
        />
        {/* Overlay sombre */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(rgba(0,0,0,0.65), rgba(15,23,42,0.85))' }}
        />

        {/* Contenu */}
        <div className="relative z-10 mx-auto max-w-3xl">


          {/* ── Titre dynamique ── */}
          <h1 className="animate-fadeUp delay-200 text-5xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
            {isAdmin
              ? <GreetingHero firstName="BOSS" />
              : (isBailleur || isAgentTerrain || isLocataire)
              ? <GreetingHero firstName={firstName} />
              : <>{t('title1')}<span className="mt-1 block bg-linear-to-r from-gold to-gold-light bg-clip-text text-transparent">{t('titleGold')}</span></>
            }
          </h1>

          {/* ── Sous-titre dynamique ── */}
          <p className="animate-fadeUp delay-300 mt-5 text-lg text-gray-300 max-w-xl mx-auto">
            {isAdmin
              ? t('roleAdminSub')
              : isBailleur
              ? t('roleBailleurSub')
              : isAgentTerrain
              ? t('roleAgentSub')
              : isLocataire
              ? t('roleLocataireSub')
              : t('subtitle')
            }
          </p>

          {/* ── CTA dynamiques ── */}
          {isAdmin ? (
            <div className="animate-fadeUp delay-400 mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/espace"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gray-900 shadow-lg hover:bg-gold-light transition-colors">
                <i className="fa-solid fa-gauge" /> {t('ctaDashboard')}
              </Link>
              <Link href="/espace/verifications"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-clipboard-check" /> {t('ctaVerifications')}
              </Link>
              <Link href="/espace/users"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-users" /> {t('ctaUsers')}
              </Link>
            </div>
          ) : isBailleur ? (
            <div className="animate-fadeUp delay-400 mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/publier"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gray-900 shadow-lg hover:bg-gold-light transition-colors">
                <i className="fa-solid fa-plus" /> {t('ctaPublish')}
              </Link>
              <Link href="/bailleur/listings"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-list" /> {t('ctaMyListings')}
              </Link>
              <Link href="/bailleur"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-chart-line" /> {t('ctaDashboard')}
              </Link>
            </div>
          ) : isAgentTerrain ? (
            <div className="animate-fadeUp delay-400 mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/agent/missions"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gray-900 shadow-lg hover:bg-gold-light transition-colors">
                <i className="fa-solid fa-map-location-dot" /> {t('ctaMyMissions')}
              </Link>
              <Link href="/agent"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-chart-line" /> {t('ctaMyDashboard')}
              </Link>
            </div>
          ) : isLocataire ? (
            <div className="animate-fadeUp delay-400 mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/listings"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gray-900 shadow-lg hover:bg-gold-light transition-colors">
                <i className="fa-solid fa-magnifying-glass" /> {t('ctaSearch')}
              </Link>
              <Link href="/listings?tab=favoris"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-heart" /> {t('ctaMyFavorites')}
              </Link>
              <Link href="/locataire/bookings"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-calendar-check" /> {t('ctaMyBookings')}
              </Link>
            </div>
          ) : (
            /* ── Visiteur anonyme ── */
            <div className="animate-fadeUp delay-400 mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/listings"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-bold text-gray-900 shadow-lg hover:bg-gold-light transition-colors">
                <i className="fa-solid fa-magnifying-glass" /> {t('searchBtn')}
              </Link>
              <Link href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-arrow-right" /> {t('ctaCreateAccount')}
              </Link>
            </div>
          )}
        </div>

      </section>

      {/* ══ STATS ═════════════════════════════════════════════════════ */}
      <section className="bg-bg border-t border-line py-16 px-4">
        <div className="aa-container">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
            {STATS_DATA.map((s) => (
              <div key={s.key} className="flex flex-col items-center text-center px-8 py-8 sm:py-4">
                <p className="text-5xl font-extrabold tracking-tight text-text">{s.value}</p>
                <div className="mt-3 h-0.5 w-10 rounded-full bg-gold" />
                <p className="mt-3 text-sm font-medium text-sub">{t(`stats.${s.key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ANNONCES PARTICULIERS ════════════════════════════════════ */}
      <section className="py-20 px-4 bg-bg">
        <div className="aa-container">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-pale px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-gold-dark mb-3">
                <i className="fa-solid fa-user text-[9px]" /> {t('individualsBadge')}
              </span>
              <h2 className="text-3xl font-bold text-text md:text-4xl">
                {t('individualsTitle')}
              </h2>
              <p className="mt-2 text-sub">{t('individualsSub')}</p>
            </div>
            <Link
              href="/listings"
              className="btn-outline text-text self-start sm:self-auto whitespace-nowrap"
            >
              {t('seeAllListings')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sub">
              <i className="fa-solid fa-house-circle-xmark mb-4 text-4xl text-gold/40" />
              <p className="text-sm">{t('noListings')}</p>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {listings.map((l) => {
                const isAgence   = l.owner?.roles?.includes('PRO_AGENCE') && !!l.owner.agencySlug;
                const isProAgence = l.owner?.roles?.includes('PRO_AGENCE');
                const isBoosted  = l.boostUntil && new Date(l.boostUntil) > new Date();
                return (
                <div key={l.id} className="listing-card group block">
                <Link href={`/listings/${l.id}`} className="block">

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
                    {/* Badges haut gauche */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      {isBoosted && (
                        <span className="flex items-center gap-1 rounded-full bg-gold text-gray-900 text-[10px] font-bold px-2.5 py-0.5 shadow-sm">
                          <i className="fa-solid fa-bolt text-[9px]" /> En vedette
                        </span>
                      )}
                      {isProAgence && (
                        <span className="flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-sm text-gold text-[10px] font-bold px-2.5 py-0.5">
                          <i className="fa-solid fa-crown text-[9px]" /> {l.owner?.agencyName ?? 'Agence PRO'}
                        </span>
                      )}
                      {!isBoosted && !isProAgence && isNewListing(l.createdAt) && (
                        <span className="rounded-full border border-gold/50 bg-gold-pale px-2.5 py-0.5 text-[10px] font-semibold text-gold-dark">
                          {t('newBadge')}
                        </span>
                      )}
                    </div>
                    {/* Badge prix */}
                    <span className="absolute bottom-3 left-3 rounded-full border border-gold/50 bg-gold-pale px-2.5 py-1 text-xs font-semibold text-gold-dark">
                      {formatPrice(l.price)}
                    </span>
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
                {/* Badge agence — hors de l'enveloppe Link pour éviter <a> dans <a> */}
                {isAgence && (
                  <div className="px-4 pb-4 -mt-1">
                    <Link
                      href={`/agences/${l.owner!.agencySlug!}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-pale px-2.5 py-0.5 text-[11px] font-semibold text-gold-dark hover:bg-gold/20 transition-colors"
                    >
                      {l.owner!.avatar && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.owner!.avatar} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                      )}
                      {!l.owner!.avatar && <i className="fa-solid fa-building text-[9px]" />}
                      {l.owner!.agencyName ?? `${l.owner!.firstName} ${l.owner!.lastName}`}
                    </Link>
                  </div>
                )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ══ AGENCES PARTENAIRES ══════════════════════════════════════ */}
      {agencies.length > 0 && (
        <section className="py-20 px-4 bg-card">
          <div className="aa-container">

            {/* En-tête */}
            <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-pale px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-gold-dark mb-3">
                  <i className="fa-solid fa-building text-[9px]" /> {t('agenciesBadge')}
                </span>
                <h2 className="text-3xl font-bold text-text md:text-4xl">
                  {t('agenciesTitle')}
                </h2>
                <p className="mt-2 text-sub">{t('agenciesSub')}</p>
              </div>
              <Link
                href="/agences"
                className="btn-outline text-text self-start sm:self-auto whitespace-nowrap"
              >
                Voir toutes les agences <i className="fa-solid fa-arrow-right ml-1 text-xs" />
              </Link>
            </div>

            {/* Grille agences */}
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {agencies.slice(0, 8).map((agency) => {
                const name    = agency.agencyName ?? `${agency.firstName} ${agency.lastName}`;
                const isPro   = agency.subscription?.plan === 'PRO' && agency.subscription?.status === 'ACTIVE';
                const href    = agency.agencySlug ? `/agences/${agency.agencySlug}` : null;
                const count   = agency._count.listings;

                return (
                  <div key={agency.id} className={`group rounded-2xl border bg-bg overflow-hidden transition-all duration-300 hover:shadow-lg ${isPro ? 'border-gold/40 hover:border-gold/70' : 'border-line hover:border-gold/30'}`}>

                    {/* Bandeau PRO */}
                    {isPro && (
                      <div className="h-1 w-full bg-linear-to-r from-gold to-gold-light" />
                    )}

                    <div className="p-5">
                      {/* Avatar + badge PRO */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="relative">
                          {agency.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={agency.avatar} alt={name}
                              className="h-14 w-14 rounded-xl object-cover border border-line" />
                          ) : (
                            <div className={`h-14 w-14 rounded-xl flex items-center justify-center text-xl font-extrabold border ${isPro ? 'bg-gold/10 border-gold/30 text-gold-dark' : 'bg-gold-pale border-line text-gold-dark'}`}>
                              {name[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        {isPro && (
                          <span className="flex items-center gap-1 bg-gold/10 border border-gold/30 text-gold-dark text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <i className="fa-solid fa-crown text-[8px]" /> PRO
                          </span>
                        )}
                      </div>

                      {/* Nom */}
                      <h3 className="font-extrabold text-text text-sm leading-tight line-clamp-1 group-hover:text-gold-dark transition-colors mb-1">
                        {name}
                      </h3>

                      {/* Bio */}
                      {agency.bio && (
                        <p className="text-xs text-sub line-clamp-2 mb-3 leading-relaxed">{agency.bio}</p>
                      )}

                      {/* Stats */}
                      <p className="text-[11px] text-sub flex items-center gap-1.5 mb-4">
                        <i className="fa-solid fa-building text-gold-dark text-[10px]" />
                        <span className="font-semibold text-text">{count}</span> bien{count > 1 ? 's' : ''} disponible{count > 1 ? 's' : ''}
                      </p>

                      {/* CTA */}
                      {href ? (
                        <Link href={href}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold-pale hover:bg-gold/20 text-gold-dark text-xs font-semibold py-2 transition-colors">
                          <i className="fa-solid fa-store text-[10px]" /> {t('viewVitrine')}
                        </Link>
                      ) : (
                        <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-bg text-sub text-xs font-medium py-2 cursor-default">
                          {t('noVitrine')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>
      )}

      {/* ══ RÉGIONS ════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-card">
        <div className="aa-container">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-text md:text-4xl">
                {t('regionsTitle')}
              </h2>
              <p className="mt-2 text-sub">
                {t('regionsSub')}
              </p>
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {REGIONS.slice(0, 10).map((r) => (
              <Link
                key={r.slug}
                href={`/listings?region=${encodeURIComponent(r.slug)}&limit=6&page=1`}
                className="group flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-bg hover:border-gold-dark/50 hover:bg-gold-pale/30 transition-all duration-300"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-pale text-gold-dark transition-transform duration-300 group-hover:scale-110">
                  <i className="fa-solid fa-location-dot text-sm" />
                </span>
                <span className="text-sm font-bold text-text">{r.name}</span>
              </Link>
            ))}
            <Link
              href="/listings"
              className="group relative h-32 overflow-hidden rounded-2xl border border-line bg-bg flex flex-col items-center justify-center gap-1 hover:bg-gold-pale transition"
            >
              <i className="fa-solid fa-map-location-dot text-2xl text-gold-dark group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-text">
                {t('seeAllShort')}
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION CTA — varie selon le rôle */}
      <section className="bg-dark py-20 px-4">
        <div className="aa-container flex flex-col items-center text-center">

          {isAdmin ? (
            /* ── Admin ── */
            <>
              <h2 className="max-w-2xl text-3xl font-bold text-white md:text-4xl">
                <GreetingCTA firstName="BOSS" fallback={t('ctaAdminFallback')} />
              </h2>
              <p className="mt-4 max-w-xl text-gray-300">
                {t('ctaAdminDesc')}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/espace" className="btn-gold">
                  <i className="fa-solid fa-gauge mr-1.5 text-sm" /> {t('ctaDashboard')}
                </Link>
                <Link href="/espace/verifications" className="btn-outline text-white">
                  <i className="fa-solid fa-clipboard-check mr-1.5 text-sm" /> {t('ctaVerifications')}
                </Link>
                <Link href="/espace/users" className="btn-outline text-white">
                  <i className="fa-solid fa-users mr-1.5 text-sm" /> {t('ctaUsers')}
                </Link>
              </div>
            </>
          ) : isBailleur ? (
            /* ── Bailleur / Pro_Agence ── */
            <>
              <h2 className="max-w-2xl text-3xl font-bold text-white md:text-4xl">
                <GreetingCTA firstName={firstName ?? null} fallback={t('ctaBailleurFallback')} />
              </h2>
              <p className="mt-4 max-w-xl text-gray-300">
                {t('ctaBailleurDesc')}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/publier" className="btn-gold">
                  <i className="fa-solid fa-plus mr-1.5 text-sm" /> {t('ctaPublish')}
                </Link>
                <Link href="/bailleur/listings" className="btn-outline text-white">
                  <i className="fa-solid fa-list mr-1.5 text-sm" /> {t('ctaMyListings')}
                </Link>
                {isProAgence && (
                  <Link href="/bailleur/abonnement" className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold/10 transition-colors">
                    <i className="fa-solid fa-crown text-sm" /> {t('ctaMySubscription')}
                  </Link>
                )}
              </div>
            </>
          ) : isAgentTerrain ? (
            /* ── Agent terrain ── */
            <>
              <h2 className="max-w-2xl text-3xl font-bold text-white md:text-4xl">
                <GreetingCTA firstName={firstName ?? null} fallback={t('ctaAgentFallback')} />
              </h2>
              <p className="mt-4 max-w-xl text-gray-300">
                {t('ctaAgentDesc')}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/agent/missions" className="btn-gold">
                  <i className="fa-solid fa-map-location-dot mr-1.5 text-sm" /> {t('ctaMyMissions')}
                </Link>
                <Link href="/agent" className="btn-outline text-white">
                  <i className="fa-solid fa-chart-line mr-1.5 text-sm" /> {t('ctaMyDashboard')}
                </Link>
              </div>
            </>
          ) : isLocataire ? (
            /* ── Locataire ── */
            <>
              <h2 className="max-w-2xl text-3xl font-bold text-white md:text-4xl">
                <GreetingCTA firstName={firstName ?? null} fallback={t('ctaLocataireFallback')} />
              </h2>
              <p className="mt-4 max-w-xl text-gray-300">
                {t('ctaLocataireDesc')}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/listings" className="btn-gold">
                  <i className="fa-solid fa-magnifying-glass mr-1.5 text-sm" /> {t('ctaSearch')}
                </Link>
                <Link href="/listings?tab=favoris" className="btn-outline text-white">
                  <i className="fa-solid fa-heart mr-1.5 text-sm" /> {t('ctaMyFavorites')}
                </Link>
                <Link href="/locataire/bookings" className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold/10 transition-colors">
                  <i className="fa-solid fa-calendar-check text-sm" /> {t('ctaMyBookings')}
                </Link>
              </div>
            </>
          ) : (
            /* ── Visiteur anonyme ── */
            <>
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
                <i className="fa-solid fa-star" /> {t('ctaVisitorBadge')}
              </span>
              <h2 className="max-w-2xl text-3xl font-bold text-white md:text-4xl">
                {t('ctaVisitorTitle')}
              </h2>
              <p className="mt-4 max-w-xl text-gray-300">{t('ctaVisitorDesc')}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/sign-up" className="btn-gold">
                  {t('ctaVisitorStart')} <i className="fa-solid fa-arrow-right ml-1 text-sm" />
                </Link>
                <Link href="/listings" className="btn-outline text-white">
                  {t('ctaVisitorBrowse')}
                </Link>
              </div>
            </>
          )}

        </div>
      </section>

    </main>
  );
}
