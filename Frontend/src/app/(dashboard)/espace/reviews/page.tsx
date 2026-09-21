'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Review, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';

type RatingFilter = 'ALL' | '5' | '4' | '3' | '2' | '1';

const RATING_FILTERS: RatingFilter[] = ['ALL', '5', '4', '3', '2', '1'];

const STAT_CARD_COLORS: Record<RatingFilter, { color: string; bg: string }> = {
  ALL: { color: 'text-gold-dark',                                bg: 'bg-gold-pale' },
  '5': { color: 'text-emerald-600 dark:text-emerald-400',        bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  '4': { color: 'text-blue-600 dark:text-blue-400',              bg: 'bg-blue-50 dark:bg-blue-950/30' },
  '3': { color: 'text-amber-600 dark:text-amber-400',            bg: 'bg-amber-50 dark:bg-amber-950/30' },
  '2': { color: 'text-purple-600 dark:text-purple-400',          bg: 'bg-purple-50 dark:bg-purple-950/30' },
  '1': { color: 'text-red-600 dark:text-red-400',                bg: 'bg-red-50 dark:bg-red-950/30' },
};

export default function AdminReviewsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('admin');
  const tRef         = useRef(t);
  tRef.current       = t;

  const [reviews, setReviews]   = useState<Review[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<Review | null>(null);
  const [limit, setLimit]       = useState(20);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('ALL');
  const [ratingCounts, setRatingCounts] = useState<Record<RatingFilter, number>>({
    ALL: 0, '5': 0, '4': 0, '3': 0, '2': 0, '1': 0,
  });
  const LIMIT_OPTIONS = [10, 20, 50] as const;

  const fetchRatingCounts = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const results = await Promise.all(
        RATING_FILTERS.map((r) =>
          api.get<PaginatedResponse<Review>>(
            `/reviews/all?page=1&limit=1${r === 'ALL' ? '' : `&rating=${r}`}`,
            token,
          ),
        ),
      );
      const next = {} as Record<RatingFilter, number>;
      RATING_FILTERS.forEach((r, i) => { next[r] = results[i]!.total; });
      setRatingCounts(next);
    } catch {
      // silencieux — les compteurs ne sont qu'indicatifs
    }
  }, [getToken]);

  const fetchData = useCallback(async (p: number, lim = limit, rf = ratingFilter) => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const ratingQs = rf === 'ALL' ? '' : `&rating=${rf}`;
      const res = await api.get<PaginatedResponse<Review>>(`/reviews/all?page=${p}&limit=${lim}${ratingQs}`, token);
      setReviews(res.data);
      setTotal(res.total);
    } catch {
      setError(tRef.current('reviewsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, limit, ratingFilter]);

  useEffect(() => { fetchData(page); }, [fetchData, page]);
  useEffect(() => { void fetchRatingCounts(); }, [fetchRatingCounts]);

  const handleFilterChange = (rf: RatingFilter) => {
    setRatingFilter(rf);
    setPage(1);
    fetchData(1, limit, rf);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    const token = await getToken();
    if (!token) return;
    setActionId(deleteModal.id);
    try {
      await api.delete(`/reviews/${deleteModal.id}`, token);
      setDeleteModal(null);
      toast.success(t('toastReviewDeleted'));
      await Promise.all([fetchData(page), fetchRatingCounts()]);
    } catch {
      toast.error(t('errDelete'));
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const FILTER_LABELS: Record<RatingFilter, string> = {
    ALL: t('reviewsFilterAll'),
    '5': t('reviewsRating5'),
    '4': t('reviewsRating4'),
    '3': t('reviewsRating3'),
    '2': t('reviewsRating2'),
    '1': t('reviewsRating1'),
  };
  const FILTER_ICONS: Record<RatingFilter, string> = {
    ALL: 'fa-star', '5': 'fa-star', '4': 'fa-star', '3': 'fa-star', '2': 'fa-star', '1': 'fa-star',
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('reviewsTitle')}</h1>
          <p className="mt-1 text-sm text-sub">{t('reviewsCount', { count: total })}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-sub whitespace-nowrap">{t('rowsLabel')}</span>
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

      {/* Cartes stat/filtre par note */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {RATING_FILTERS.map((r) => (
          <StatFilterCard
            key={r}
            icon={FILTER_ICONS[r]}
            label={FILTER_LABELS[r]}
            value={ratingCounts[r]}
            color={STAT_CARD_COLORS[r].color}
            bg={STAT_CARD_COLORS[r].bg}
            active={ratingFilter === r}
            onClick={() => handleFilterChange(r)}
            selectedLabel={t('filterSelected')}
          />
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => fetchData(page)} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-star text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">{t('reviewsEmpty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-line bg-card p-5 flex flex-col gap-3 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">
                    {review.author?.firstName} {review.author?.lastName}
                  </p>
                  <p className="text-xs text-sub">{formatDate(review.createdAt)}</p>
                </div>
                <Stars rating={review.rating} />
              </div>

              {review.listing && (
                <Link href={`/listings/${review.listingId}`} target="_blank"
                  className="text-xs text-gold-dark hover:underline truncate">
                  <i className="fa-solid fa-house text-xs mr-1" />
                  {review.listing.title} — {review.listing.city}
                </Link>
              )}

              <p className="text-sm text-sub line-clamp-3 flex-1 italic">
                {review.comment ? `“${review.comment}”` : t('reviewsNoComment')}
              </p>

              <button
                onClick={() => setDeleteModal(review)}
                disabled={actionId !== null}
                className="self-start text-xs font-medium border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg px-3 py-1.5 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
              >
                <i className="fa-solid fa-trash text-xs mr-1" />{t('delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            <i className="fa-solid fa-chevron-left text-xs" /> {t('previous')}
          </button>
          <span className="text-sm text-sub">{t('pageOf', { page, total: totalPages })}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text disabled:pointer-events-none disabled:opacity-40">
            {t('next')} <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
              <i className="fa-solid fa-trash text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-1">{t('modalDeleteReview')}</h2>
            <p className="text-sm text-sub mb-2">
              {t('reviewFrom')} <span className="font-medium text-text">{deleteModal.author?.firstName} {deleteModal.author?.lastName}</span> · {deleteModal.rating}/5
            </p>
            {deleteModal.comment && (
              <p className="text-xs text-sub mb-6 line-clamp-3 italic">&ldquo;{deleteModal.comment}&rdquo;</p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(null)}
                className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors">
                {t('cancel')}
              </button>
              <button onClick={handleDelete} disabled={actionId !== null}
                className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                {actionId !== null ? <i className="fa-solid fa-spinner fa-spin" /> : t('delete')}
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
    <div className="flex items-center gap-0.5 shrink-0">
      {[1, 2, 3, 4, 5].map((s) => (
        <i
          key={s}
          className={`fa-${s <= rating ? 'solid' : 'regular'} fa-star text-xs ${s <= rating ? 'text-gold-dark' : 'text-sub'}`}
        />
      ))}
    </div>
  );
}
