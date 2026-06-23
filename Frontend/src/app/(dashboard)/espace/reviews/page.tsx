'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Review, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

export default function AdminReviewsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<Review | null>(null);
  const [limit, setLimit]       = useState(20);
  const LIMIT_OPTIONS = [10, 20, 50] as const;

  const fetchData = useCallback(async (p: number, lim = limit) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Review>>(`/reviews/all?page=${p}&limit=${lim}`, token);
      setReviews(res.data);
      setTotal(res.total);
    } catch {
      setError('Impossible de charger les avis.');
    } finally {
      setLoading(false);
    }
  }, [getToken, limit]);

  useEffect(() => { fetchData(page); }, [fetchData, page]);

  const handleDelete = async () => {
    if (!deleteModal) return;
    const token = await getToken();
    if (!token) return;
    setActionId(deleteModal.id);
    try {
      await api.delete(`/reviews/${deleteModal.id}`, token);
      setDeleteModal(null);
      toast.success('Avis supprimé');
      await fetchData(page);
    } catch {
      toast.error('Erreur lors de la suppression.');
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Avis locataires</h1>
          <p className="mt-1 text-sm text-sub">{total} avis au total</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-sub whitespace-nowrap">Lignes :</span>
          <div className="flex gap-1">
            {LIMIT_OPTIONS.map((l) => (
              <button key={l} onClick={() => { setLimit(l); setPage(1); fetchData(1, l); }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${limit === l ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => fetchData(page)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-star text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">Aucun avis pour le moment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-text">
                    {review.author?.firstName} {review.author?.lastName}
                  </p>
                  <Stars rating={review.rating} />
                  <span className="text-xs text-sub">{formatDate(review.createdAt)}</span>
                </div>
                {review.listing && (
                  <Link href={`/listings/${review.listingId}`} target="_blank"
                    className="text-xs text-gold-dark hover:underline">
                    <i className="fa-solid fa-house text-xs mr-1" />
                    {review.listing.title} — {review.listing.city}
                  </Link>
                )}
                {review.comment && (
                  <p className="mt-2 text-sm text-sub line-clamp-2">{review.comment}</p>
                )}
              </div>
              <button
                onClick={() => setDeleteModal(review)}
                disabled={actionId !== null}
                className="shrink-0 text-xs font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <i className="fa-solid fa-trash text-xs mr-1" />Supprimer
              </button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            <i className="fa-solid fa-chevron-left text-xs" /> Précédent
          </button>
          <span className="text-sm text-sub">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            Suivant <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <i className="fa-solid fa-trash text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-1">Supprimer cet avis ?</h2>
            <p className="text-sm text-sub mb-2">
              De <span className="font-medium text-text">{deleteModal.author?.firstName} {deleteModal.author?.lastName}</span> · {deleteModal.rating}/5
            </p>
            {deleteModal.comment && (
              <p className="text-xs text-sub mb-6 line-clamp-3 italic">&ldquo;{deleteModal.comment}&rdquo;</p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(null)}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={actionId !== null}
                className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {actionId !== null ? <i className="fa-solid fa-spinner fa-spin" /> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <i
          key={s}
          className={`fa-${s <= rating ? 'solid' : 'regular'} fa-star text-xs ${s <= rating ? 'text-gold-dark' : 'text-sub'}`}
        />
      ))}
    </div>
  );
}
