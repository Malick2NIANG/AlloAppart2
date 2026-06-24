'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Listing, PaginatedResponse } from '@/types';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

export default function BoostPage() {
  const { getToken }  = useAuth();
  const { toast }     = useToast();
  const searchParams  = useSearchParams();
  const [listings, setListings]   = useState<Listing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [boosting, setBoosting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await api.get<PaginatedResponse<Listing>>('/listings/mine', token);
      setListings(res.data.filter((l) => l.status === 'ACTIVE'));
    } catch {
      toast.error('Impossible de charger les annonces.');
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') toast.success('Boost activé ! Votre annonce est mise en avant.');
    if (status === 'cancel')  toast.error('Paiement annulé.');
  }, [searchParams, toast]);

  const boost = async (listingId: string) => {
    setBoosting(listingId);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await api.post<{ payment_url: string }>(
        `/listings/${listingId}/boost`, {}, token
      );
      window.location.href = res.payment_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du boost.');
      setBoosting(null);
    }
  };

  const isActive = (listing: Listing) =>
    !!listing.boostUntil && new Date(listing.boostUntil) > new Date();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Booster une annonce</h1>
        <p className="mt-1 text-sm text-sub">
          Mettez votre annonce en avant pendant 7 jours · 5 000 FCFA
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height="90px" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-rocket text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune annonce active</p>
          <p className="mt-1 text-sm text-sub">Publiez une annonce pour pouvoir la booster.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listings.map((listing) => {
            const boosted = isActive(listing);
            return (
              <div key={listing.id} className={`rounded-xl border p-4 ${boosted ? 'border-gold-dark bg-gold-pale/20' : 'border-line bg-card'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text truncate">{listing.title}</p>
                    <p className="text-sm text-sub mt-0.5">
                      <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                      {listing.city} · {formatPrice(listing.price)}/mois
                    </p>
                    {boosted && listing.boostUntil && (
                      <p className="text-xs text-gold-dark font-medium mt-1">
                        <i className="fa-solid fa-rocket text-xs mr-1" />
                        Boosté jusqu&apos;au {new Date(listing.boostUntil).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => void boost(listing.id)}
                    disabled={boosted || boosting !== null}
                    className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 ${
                      boosted
                        ? 'bg-gold-pale text-gold-dark cursor-default'
                        : 'btn-gold'
                    }`}
                  >
                    {boosting === listing.id ? (
                      <i className="fa-solid fa-spinner fa-spin" />
                    ) : boosted ? (
                      <><i className="fa-solid fa-check mr-1" />Actif</>
                    ) : (
                      <><i className="fa-solid fa-rocket mr-1" />Booster</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
