'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { getAgencyColorOption } from '@/lib/agencyColors';
import { getListingPriceAmounts } from '@/types';
import type { User } from '@/types';
import { useToast } from '@/components/ui/Toast';
import type { Agency, AgencyListing } from './page';

type RentalFilter = 'ALL' | 'NIGHTLY' | 'MONTHLY';
const PAGE_SIZE_OPTIONS = [6, 9, 12, 24] as const;
// Les 5 types du formulaire de publication (source de vérité, cf.
// (public)/publier/page.tsx) — toujours proposés dans le filtre, même si
// l'agence n'a pas encore d'annonce de ce type.
const ALL_LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;

function fmtPrice(p: string | number) {
  return Number(p).toLocaleString('fr-FR');
}

function isPremium(agency: Agency) {
  return agency.subscription?.plan === 'PRO' && agency.subscription?.status === 'ACTIVE';
}

export default function AgenceClientShell({ agency }: { agency: Agency }) {
  const t                              = useTranslations('agences');
  const router                         = useRouter();
  const searchParams                   = useSearchParams();
  const { isSignedIn, getToken }       = useAuth();
  const { toast }                       = useToast();
  const [contacting,   setContacting]  = useState<string | null>(null);
  const [search,       setSearch]      = useState('');
  const [minPrice,     setMinPrice]    = useState('');
  const [maxPrice,     setMaxPrice]    = useState('');
  const [typeFilter,   setTypeFilter]  = useState('');
  const [rentalFilter, setRentalFilter] = useState<RentalFilter>('ALL');
  const [pageSize,     setPageSize]    = useState<number>(PAGE_SIZE_OPTIONS[1]);
  const [page,         setPage]        = useState(1);

  // La barre de recherche globale (Navbar) — localité + budget min/max —
  // fonctionne aussi sur la vitrine : elle pousse q/minPrice/maxPrice dans
  // l'URL de cette même page au lieu de partir vers /listings.
  useEffect(() => {
    setSearch(searchParams.get('q') ?? '');
    setMinPrice(searchParams.get('minPrice') ?? '');
    setMaxPrice(searchParams.get('maxPrice') ?? '');
  }, [searchParams]);

  // Revenir à la page 1 dès qu'un filtre ou la taille de page change.
  useEffect(() => {
    setPage(1);
  }, [search, minPrice, maxPrice, typeFilter, rentalFilter, pageSize]);

  const typeLabels = t.raw('typeLabels') as Record<string, string>;
  const name       = agency.agencyName ?? `${agency.firstName} ${agency.lastName}`;
  const premium    = isPremium(agency);
  // Couleur d'accent choisie par l'agence (page "Ma vitrine") — n'affecte que
  // le hero (identité de marque) ; la grille catalogue en dessous reste en
  // gold standard AlloAppart, cf. décision produit du 2026-09-11.
  const color      = getAgencyColorOption(agency.agencyColor);

  // Tracker la vue vitrine (fire-and-forget)
  useEffect(() => {
    if (agency.agencySlug) {
      api.post(`/agences/${agency.agencySlug}/view`, {}).catch(() => {});
    }
  }, [agency.agencySlug]);

  const since = new Date(agency.createdAt).getFullYear();

  const distinctTypes = ALL_LISTING_TYPES;

  const listings = useMemo(() => {
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    return agency.listings.filter((l) => {
      const matchesSearch = !search
        || l.title.toLowerCase().includes(search.toLowerCase())
        || l.city.toLowerCase().includes(search.toLowerCase());
      const matchesType   = !typeFilter || l.type === typeFilter;
      const matchesRental = rentalFilter === 'ALL' || l.rentalMode === rentalFilter || l.rentalMode === 'MIXED';
      const refPrice       = getListingPriceAmounts(l)[0]?.amount ?? 0;
      const matchesPrice   = (min == null || refPrice >= min) && (max == null || refPrice <= max);
      return matchesSearch && matchesType && matchesRental && matchesPrice;
    });
  }, [agency.listings, search, minPrice, maxPrice, typeFilter, rentalFilter]);

  const totalPages = Math.max(1, Math.ceil(listings.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageListings = listings.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleContact = async (listing: AgencyListing) => {
    if (!isSignedIn) { router.push(`/sign-in?redirect_url=/agences/${agency.agencySlug}`); return; }
    setContacting(listing.id);
    try {
      const token = await getToken();
      if (!token) return;
      const room = await api.post<{ id: string }>('/messages/rooms', { listingId: listing.id }, token);
      // Redirige vers la messagerie du bon espace (pas la page publique
      // générique) — même logique de rôle que NavbarClient.tsx.
      let base = '/locataire/messages';
      try {
        const me = await api.get<User>('/auth/me', token);
        if (me.roles.includes('AGENT_TERRAIN')) base = '/agent/messages';
        else if (me.roles.includes('BAILLEUR') || me.roles.includes('PRO_AGENCE')) base = '/bailleur/messages';
      } catch {}
      router.push(`${base}?room=${room.id}`);
    } catch (err: unknown) {
      const status = (err as { status?: number } | undefined)?.status;
      toast.error(status === 400 ? t('contactOwnListing') : t('contactError'));
    } finally { setContacting(null); }
  };

  return (
    <main className="min-h-screen bg-bg">

      {/* ── Fil d'Ariane — la vitrine ne doit jamais être un cul-de-sac,
          même si l'utilisateur y arrive sans historique de navigation
          (lien partagé, onglet direct, etc.) ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-sub hover:text-gold-dark transition-colors">
          <i className="fa-solid fa-arrow-left text-xs" />
          {t('backToHome')}
        </Link>
      </div>

      {/* ── Hero agence ── */}
      <div className={`relative overflow-hidden ${premium ? 'bg-gradient-to-br from-[#1a1200] to-[#2d1f00]' : 'bg-gradient-to-br from-gray-900 to-gray-800'}`}>
        {/* Fond décoratif — teinté avec la couleur d'accent choisie par l'agence */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: color.hex }} />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: color.hex }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

            {/* Avatar / Logo */}
            <div className="shrink-0">
              {agency.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agency.avatar} alt={name}
                  className="h-24 w-24 rounded-2xl object-cover shadow-xl"
                  style={{ boxShadow: `0 0 0 4px ${color.hex}4d` }} />
              ) : (
                <div className="h-24 w-24 rounded-2xl flex items-center justify-center text-3xl font-extrabold"
                  style={{ backgroundColor: `${color.hex}33`, boxShadow: `0 0 0 4px ${color.hex}4d`, color: color.hex }}>
                  {name[0]}
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mb-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{name}</h1>
                {premium && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color.hex}33`, borderColor: `${color.hex}66`, borderWidth: 1, color: color.hex }}>
                    <i className="fa-solid fa-crown text-[9px]" /> {t('proBadge')}
                  </span>
                )}
              </div>

              {agency.bio && (
                <p className="text-gray-300 text-sm max-w-xl leading-relaxed mb-4">{agency.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 justify-center sm:justify-start text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-building text-xs" style={{ color: color.hex }} />
                  <span className="font-semibold text-white">{agency._count.listings}</span>{' '}
                  {t(agency._count.listings > 1 ? 'biens' : 'bien')}{' '}
                  {t(agency._count.listings > 1 ? 'disponibles' : 'disponible')}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-xs" style={{ color: color.hex }} />
                  {t('memberSince')} {since}
                </span>
                {agency.agencyAddress && (
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-location-dot text-xs" style={{ color: color.hex }} />
                    {agency.agencyAddress}
                  </span>
                )}
                {agency.phone && (
                  <a href={`tel:${agency.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <i className="fa-solid fa-phone text-xs" style={{ color: color.hex }} />
                    {agency.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Barre recherche + compteur */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-lg font-extrabold text-text">
            <span className="text-gold-dark">{t('catalogueAvailableCount', { count: listings.length })}</span>
          </h2>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sub text-xs" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9 pr-4 py-2 rounded-xl border border-line bg-card text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40 w-64"
            />
          </div>
        </div>

        {/* Filtres — type de bien, mode de location, taille de page */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-line bg-card text-sm text-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold/40">
            <option value="">{t('filterAllTypes')}</option>
            {distinctTypes.map((type) => (
              <option key={type} value={type}>{typeLabels[type] ?? type}</option>
            ))}
          </select>

          <select value={rentalFilter} onChange={(e) => setRentalFilter(e.target.value as RentalFilter)}
            className="rounded-xl border border-line bg-card text-sm text-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold/40">
            <option value="ALL">{t('filterAllModes')}</option>
            <option value="NIGHTLY">{t('filterNightly')}</option>
            <option value="MONTHLY">{t('filterMonthly')}</option>
          </select>

          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
            className="ml-auto rounded-xl border border-line bg-card text-sm text-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold/40">
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} {t('perPageLabel')}</option>
            ))}
          </select>
        </div>

        {/* Grille annonces */}
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-16 text-center">
            <i className="fa-regular fa-building text-4xl text-sub mb-3 block" />
            <p className="font-semibold text-text">{t('noListingsFound')}</p>
            <p className="text-sm text-sub mt-1">{t('noListingsTry')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pageListings.map((listing) => {
              const isActive = listing.boostUntil && new Date(listing.boostUntil) > new Date();
              const img      = listing.images[0];
              return (
                <div key={listing.id} className="rounded-2xl border border-line bg-card overflow-hidden hover:shadow-lg transition-shadow group">
                  {/* Image */}
                  <div className="relative h-44 bg-bg overflow-hidden">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="fa-regular fa-image text-3xl text-sub" />
                      </div>
                    )}
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                      {isActive && (
                        <span className="flex items-center gap-1 bg-gold text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          <i className="fa-solid fa-bolt text-[8px]" /> {t('featuredBadge')}
                        </span>
                      )}
                      {listing.isVerified && (
                        <span className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          <i className="fa-solid fa-shield-check text-[8px]" /> {t('verifiedBadge')}
                        </span>
                      )}
                    </div>
                    {/* Prix — 1 pastille (NIGHTLY/MONTHLY) ou 2 empilées (MIXED) */}
                    <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
                      {getListingPriceAmounts(listing).map((e) => (
                        <span key={e.unit} className="bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                          {fmtPrice(e.amount)} FCFA/{t(e.unit === 'night' ? 'perNight' : 'perMonth')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Infos */}
                  <div className="p-4">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <Link href={`/listings/${listing.id}`}
                        className="font-bold text-text text-sm leading-tight hover:text-gold-dark transition-colors line-clamp-2">
                        {listing.title}
                      </Link>
                      <span className="shrink-0 text-[10px] font-semibold bg-gold-pale text-gold-dark px-2 py-0.5 rounded-full">
                        {typeLabels[listing.type] ?? listing.type}
                      </span>
                    </div>
                    <p className="text-xs text-sub flex items-center gap-1 mb-3">
                      <i className="fa-solid fa-location-dot text-gold-dark text-[10px]" />
                      {listing.city}{listing.address ? `, ${listing.address}` : ''}
                    </p>

                    {/* Détails */}
                    <div className="flex items-center gap-3 text-xs text-sub mb-4">
                      {listing.beds    && <span><i className="fa-solid fa-bed mr-1" />{listing.beds}</span>}
                      {listing.baths   && <span><i className="fa-solid fa-bath mr-1" />{listing.baths}</span>}
                      {listing.surface && <span><i className="fa-solid fa-ruler-combined mr-1" />{listing.surface} m²</span>}
                      {listing.rooms   && !listing.beds && <span><i className="fa-solid fa-door-open mr-1" />{listing.rooms} {t('roomsLabel')}</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/listings/${listing.id}`}
                        className="flex-1 text-center rounded-xl border border-line text-sub hover:bg-bg text-xs font-medium py-2 transition-colors">
                        {t('viewListing')}
                      </Link>
                      <button
                        onClick={() => void handleContact(listing)}
                        disabled={contacting === listing.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white text-xs font-semibold py-2 disabled:opacity-50 transition-colors"
                      >
                        {contacting === listing.id
                          ? <i className="fa-solid fa-spinner fa-spin" />
                          : <><i className="fa-solid fa-comment-dots text-[10px]" /> {t('contactLabel')}</>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {listings.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-card transition-colors"
            >
              <i className="fa-solid fa-chevron-left text-xs" /> {t('paginationPrev')}
            </button>
            <span className="text-sm text-sub px-1">
              {t('paginationPageOf', { page: safePage, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-card transition-colors"
            >
              {t('paginationNext')} <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
