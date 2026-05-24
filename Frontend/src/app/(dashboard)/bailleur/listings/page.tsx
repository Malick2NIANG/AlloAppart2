'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Listing, PaginatedResponse } from '@/types';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

interface VerifModal {
  listingId: string;
  title: string;
}

export default function BailleurListingsPage() {
  const { getToken } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifModal, setVerifModal] = useState<VerifModal | null>(null);
  const [verifForm, setVerifForm] = useState({ auditType: 'BASIC', scheduledAt: '' });
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifSuccess, setVerifSuccess] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((token) => {
      if (!token) return;
      api.get<PaginatedResponse<Listing>>('/listings/mine', token)
        .then((res) => setListings(res.data))
        .finally(() => setLoading(false));
    });
  }, [getToken]);

  const requestVerif = async () => {
    if (!verifModal || !verifForm.scheduledAt) return;
    const token = await getToken();
    if (!token) return;
    setVerifLoading(true);
    try {
      await api.post('/verifications', {
        listingId: verifModal.listingId,
        auditType: verifForm.auditType,
        scheduledAt: new Date(verifForm.scheduledAt).toISOString(),
      }, token);
      setVerifSuccess(verifModal.title);
      setVerifModal(null);
      setVerifForm({ auditType: 'BASIC', scheduledAt: '' });
    } catch {
    } finally {
      setVerifLoading(false);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 16);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Mes annonces</h1>
          <p className="mt-1 text-sm text-sub">{listings.length} annonce{listings.length > 1 ? 's' : ''}</p>
        </div>
        <Link href="/publier" className="btn-gold self-start sm:self-auto">
          <i className="fa-solid fa-plus text-sm" />
          Nouvelle annonce
        </Link>
      </div>

      {verifSuccess && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          <i className="fa-solid fa-circle-check text-green-500" />
          Demande AlloVérifié envoyée pour &quot;{verifSuccess}&quot;. Un agent sera assigné prochainement.
          <button onClick={() => setVerifSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-house text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune annonce pour l&apos;instant</p>
          <p className="mt-1 text-sm text-sub">Publiez votre premier bien pour attirer des locataires.</p>
          <Link href="/publier" className="btn-gold mt-5">
            <i className="fa-solid fa-plus text-sm" /> Publier une annonce
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text truncate">{listing.title}</p>
                  <p className="text-sm text-sub mt-0.5">
                    <i className="fa-solid fa-location-dot text-gold-dark text-xs mr-1" />
                    {listing.city} · {formatPrice(listing.price)}/mois
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      listing.status === 'ACTIVE'    ? 'bg-green-100 text-green-700' :
                      listing.status === 'DRAFT'     ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      listing.status === 'RENTED'    ? 'bg-blue-50 text-blue-700' :
                                                       'bg-card border border-line text-sub'
                    }`}>
                      {{ ACTIVE: 'Active', DRAFT: 'Brouillon', RENTED: 'Louée', SUSPENDED: 'Suspendue' }[listing.status] ?? listing.status}
                    </span>
                    {listing.isVerified && (
                      <span className="text-xs bg-gold-pale text-gold-dark px-2.5 py-1 rounded-full font-medium">
                        <i className="fa-solid fa-shield-halved text-xs mr-1" /> AlloVérifié
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/bailleur/listings/${listing.id}/edit`}
                      className="text-sm font-medium text-sub hover:text-text transition-colors"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs mr-1" />Modifier
                    </Link>
                    <Link
                      href={`/listings/${listing.id}`}
                      className="text-sm font-medium text-gold-dark hover:underline"
                    >
                      Voir <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                    </Link>
                  </div>
                  {!listing.isVerified && listing.status === 'ACTIVE' && (
                    <button
                      onClick={() => setVerifModal({ listingId: listing.id, title: listing.title })}
                      className="text-xs font-medium text-gold-dark hover:text-gold-600 border border-gold-dark hover:bg-gold-pale rounded-lg py-1 px-2.5 transition-colors"
                    >
                      <i className="fa-solid fa-shield-halved text-xs mr-1" /> AlloVérifié
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AlloVérifié request modal */}
      {verifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text mb-1">Demander AlloVérifié</h2>
            <p className="text-sm text-sub mb-5 truncate">{verifModal.title}</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-sub mb-1.5">Type d&apos;audit</label>
                <div className="flex gap-3">
                  {[
                    { value: 'BASIC', label: 'Basique', desc: 'Contrôle des points essentiels' },
                    { value: 'FULL',  label: 'Complet', desc: 'Audit approfondi avec rapport' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVerifForm((f) => ({ ...f, auditType: opt.value }))}
                      className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
                        verifForm.auditType === opt.value
                          ? 'border-gold-dark bg-gold-pale'
                          : 'border-line bg-bg hover:border-gold-dark'
                      }`}
                    >
                      <p className={`text-sm font-medium ${verifForm.auditType === opt.value ? 'text-gold-dark' : 'text-text'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-sub mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-sub mb-1.5">Date et heure souhaitées</label>
                <input
                  type="datetime-local"
                  min={minDateStr}
                  value={verifForm.scheduledAt}
                  onChange={(e) => setVerifForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-gold-dark"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => { setVerifModal(null); setVerifForm({ auditType: 'BASIC', scheduledAt: '' }); }}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={requestVerif}
                disabled={!verifForm.scheduledAt || verifLoading}
                className="btn-gold text-sm disabled:opacity-50"
              >
                {verifLoading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
