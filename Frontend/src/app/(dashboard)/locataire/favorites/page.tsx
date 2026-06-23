'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { priceToNumber } from '@/types';
import type { Listing } from '@/types';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

export default function FavoritesPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getToken().then((token) => {
      if (!token) { setLoading(false); return; }
      api.get<Listing[]>('/listings/favorites', token)
        .then(setFavorites)
        .catch(() => setError('Impossible de charger vos favoris.'))
        .finally(() => setLoading(false));
    });
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const remove = async (listingId: string) => {
    const token = await getToken();
    if (!token) return;
    setRemoving(listingId);
    try {
      await api.delete(`/listings/${listingId}/favorite`, token);
      setFavorites((prev) => prev.filter((f) => f.id !== listingId));
      toast.success('Retiré des favoris');
    } catch {
      toast.error('Erreur lors de la suppression.');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text">Favoris</h1>
          <p className="mt-1 text-sm text-sub">Chargement…</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height="220px" />)}
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
          <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Favoris</h1>
        <p className="mt-1 text-sm text-sub">
          {`${favorites.length} annonce${favorites.length > 1 ? 's' : ''} sauvegardée${favorites.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-heart text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucun favori pour l&apos;instant</p>
          <p className="mt-1 text-sm text-sub">Cliquez sur le cœur d&apos;une annonce pour la sauvegarder ici.</p>
          <Link href="/listings" className="btn-gold mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
            <i className="fa-solid fa-magnifying-glass text-xs" /> Parcourir les annonces
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((listing) => (
            <div key={listing.id} className="group relative rounded-2xl border border-line bg-card overflow-hidden hover:shadow-lg hover:border-gold/30 transition-all">
              {/* Image */}
              <div className="relative h-44 overflow-hidden">
                {listing.images[0] ? (
                  <Image
                    src={listing.images[0]}
                    alt={listing.title}
                    fill
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="h-full w-full bg-gold-pale flex items-center justify-center">
                    <i className="fa-solid fa-house text-3xl text-gold/40" />
                  </div>
                )}
                {listing.isVerified && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    <i className="fa-solid fa-shield-halved text-[9px]" /> AlloVérifié
                  </span>
                )}
                {/* Remove button */}
                <button
                  onClick={() => remove(listing.id)}
                  disabled={removing === listing.id}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition hover:bg-red-50 hover:text-red-500"
                >
                  {removing === listing.id
                    ? <i className="fa-solid fa-spinner fa-spin text-xs text-sub" />
                    : <i className="fa-solid fa-heart text-xs text-red-400" />
                  }
                </button>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="font-semibold text-text truncate">{listing.title}</p>
                <p className="mt-0.5 text-xs text-sub flex items-center gap-1">
                  <i className="fa-solid fa-location-dot text-gold-dark text-[10px]" />
                  {listing.city}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-base font-extrabold text-gold-dark">
                    {priceToNumber(listing.price).toLocaleString('fr-SN')}
                    <span className="text-xs font-normal text-sub ml-1">FCFA/mois</span>
                  </p>
                  <Link
                    href={`/listings/${listing.id}`}
                    className="text-xs font-medium text-gold-dark hover:underline flex items-center gap-1"
                  >
                    Voir <i className="fa-solid fa-arrow-right text-[10px]" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
