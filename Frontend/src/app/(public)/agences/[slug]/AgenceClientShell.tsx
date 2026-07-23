'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Agency, AgencyListing } from './page';

const TYPE_LABEL: Record<string, string> = {
  APARTMENT: 'Appartement', HOUSE: 'Maison', STUDIO: 'Studio',
  VILLA: 'Villa', OFFICE: 'Bureau', LAND: 'Terrain', OTHER: 'Autre',
};

function fmtPrice(p: string | number) {
  return Number(p).toLocaleString('fr-FR');
}

function isPremium(agency: Agency) {
  return agency.subscription?.plan === 'PRO' && agency.subscription?.status === 'ACTIVE';
}

export default function AgenceClientShell({ agency }: { agency: Agency }) {
  const router           = useRouter();
  const { isSignedIn, getToken } = useAuth();
  const [contacting, setContacting] = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  const name     = agency.agencyName ?? `${agency.firstName} ${agency.lastName}`;
  const premium  = isPremium(agency);

  // Tracker la vue vitrine (fire-and-forget)
  useEffect(() => {
    if (agency.agencySlug) {
      api.post(`/agences/${agency.agencySlug}/view`, {}).catch(() => {});
    }
  }, [agency.agencySlug]);
  const since    = new Date(agency.createdAt).getFullYear();
  const listings = agency.listings.filter((l) =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase()),
  );

  const handleContact = async (listing: AgencyListing) => {
    if (!isSignedIn) { router.push(`/sign-in?redirect_url=/agences/${agency.agencySlug}`); return; }
    setContacting(listing.id);
    try {
      const token = await getToken();
      if (!token) return;
      const room = await api.post<{ id: string }>('/messages/rooms', { listingId: listing.id }, token);
      router.push(`/messages?room=${room.id}`);
    } catch { /* ignore */ }
    finally { setContacting(null); }
  };

  return (
    <main className="min-h-screen bg-bg">

      {/* ── Hero agence ── */}
      <div className={`relative overflow-hidden ${premium ? 'bg-gradient-to-br from-[#1a1200] to-[#2d1f00]' : 'bg-gradient-to-br from-gray-900 to-gray-800'}`}>
        {/* Fond décoratif */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-gold rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

            {/* Avatar / Logo */}
            <div className="shrink-0">
              {agency.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agency.avatar} alt={name}
                  className="h-24 w-24 rounded-2xl object-cover ring-4 ring-gold/30 shadow-xl" />
              ) : (
                <div className="h-24 w-24 rounded-2xl bg-gold/20 ring-4 ring-gold/30 flex items-center justify-center text-3xl font-extrabold text-gold">
                  {name[0]}
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mb-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{name}</h1>
                {premium && (
                  <span className="flex items-center gap-1 bg-gold/20 border border-gold/40 text-gold text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    <i className="fa-solid fa-crown text-[9px]" /> Agence PRO
                  </span>
                )}
              </div>

              {agency.bio && (
                <p className="text-gray-300 text-sm max-w-xl leading-relaxed mb-4">{agency.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 justify-center sm:justify-start text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-building text-gold text-xs" />
                  {agency._count.listings} bien{agency._count.listings > 1 ? 's' : ''} disponible{agency._count.listings > 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-gold text-xs" />
                  Membre depuis {since}
                </span>
                {agency.phone && (
                  <a href={`tel:${agency.phone}`} className="flex items-center gap-1.5 hover:text-gold transition-colors">
                    <i className="fa-solid fa-phone text-gold text-xs" />
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
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <h2 className="text-lg font-extrabold text-text">
            Catalogue — <span className="text-gold-dark">{listings.length} annonce{listings.length > 1 ? 's' : ''}</span>
          </h2>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sub text-xs" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans ce catalogue…"
              className="pl-9 pr-4 py-2 rounded-xl border border-line bg-card text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40 w-64"
            />
          </div>
        </div>

        {/* Grille annonces */}
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-16 text-center">
            <i className="fa-regular fa-building text-4xl text-sub mb-3 block" />
            <p className="font-semibold text-text">Aucune annonce trouvée</p>
            <p className="text-sm text-sub mt-1">Essayez d&apos;élargir votre recherche.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((listing) => {
              const isActive     = listing.boostUntil && new Date(listing.boostUntil) > new Date();
              const img          = listing.images[0];
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
                          <i className="fa-solid fa-bolt text-[8px]" /> En vedette
                        </span>
                      )}
                      {listing.isVerified && (
                        <span className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          <i className="fa-solid fa-shield-check text-[8px]" /> AlloVérifié
                        </span>
                      )}
                    </div>
                    {/* Prix */}
                    <div className="absolute bottom-2 right-2">
                      <span className="bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                        {fmtPrice(listing.price)} FCFA/mois
                      </span>
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
                        {TYPE_LABEL[listing.type] ?? listing.type}
                      </span>
                    </div>
                    <p className="text-xs text-sub flex items-center gap-1 mb-3">
                      <i className="fa-solid fa-location-dot text-gold-dark text-[10px]" />
                      {listing.city}{listing.address ? `, ${listing.address}` : ''}
                    </p>

                    {/* Détails */}
                    <div className="flex items-center gap-3 text-xs text-sub mb-4">
                      {listing.beds   && <span><i className="fa-solid fa-bed mr-1" />{listing.beds}</span>}
                      {listing.baths  && <span><i className="fa-solid fa-bath mr-1" />{listing.baths}</span>}
                      {listing.surface && <span><i className="fa-solid fa-ruler-combined mr-1" />{listing.surface} m²</span>}
                      {listing.rooms  && !listing.beds && <span><i className="fa-solid fa-door-open mr-1" />{listing.rooms} pièces</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/listings/${listing.id}`}
                        className="flex-1 text-center rounded-xl border border-line text-sub hover:bg-bg text-xs font-medium py-2 transition-colors">
                        Voir le bien
                      </Link>
                      <button
                        onClick={() => void handleContact(listing)}
                        disabled={contacting === listing.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white text-xs font-semibold py-2 disabled:opacity-50 transition-colors"
                      >
                        {contacting === listing.id
                          ? <i className="fa-solid fa-spinner fa-spin" />
                          : <><i className="fa-solid fa-comment-dots text-[10px]" /> Contacter</>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
