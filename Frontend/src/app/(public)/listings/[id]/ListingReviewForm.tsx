'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Booking } from '@/types';

interface Review {
  id: string;
  rating: number;
  comment: string | undefined;
  createdAt: string;
  author: { firstName: string; lastName: string };
}

interface Props {
  listingId: string;
}

function formatRelative(dateStr: string, t: ReturnType<typeof useTranslations>): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t('reviewToday');
  if (days === 1) return t('reviewDayAgo');
  if (days < 7) return t('reviewDaysAgo', { count: days });
  if (days < 30) return t('reviewWeeksAgo', { count: Math.floor(days / 7) });
  return t('reviewMonthsAgo', { count: Math.floor(days / 30) });
}

export default function ListingReviewForm({ listingId }: Props) {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t = useTranslations('detail');

  const [reviews,         setReviews]         = useState<Review[]>([]);
  const [eligibleBooking, setEligibleBooking]  = useState<Booking | null>(null);
  const [rating,          setRating]           = useState(0);
  const [hovered,         setHovered]          = useState(0);
  const [comment,         setComment]          = useState('');
  const [submitting,      setSubmitting]       = useState(false);
  const [sent,            setSent]             = useState(false);
  const [error,           setError]            = useState('');

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  useEffect(() => {
    api.get<Review[]>(`/reviews/listing/${listingId}`)
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [listingId]);

  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const bookings = await api.get<Booking[]>('/bookings/mine', token);
        const eligible = bookings.find(
          (b) => b.listingId === listingId && b.status === 'COMPLETED'
        );
        setEligibleBooking(eligible ?? null);
      } catch {}
    });
  }, [isSignedIn, listingId, getToken]);

  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(pathname)}`;

  const handleSubmit = async () => {
    if (!isSignedIn) { router.push(signInUrl); return; }
    if (!comment.trim() || rating === 0 || !eligibleBooking) return;
    setError('');
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const newReview = await api.post<Review>('/reviews', {
        bookingId: eligibleBooking.id,
        listingId,
        rating,
        comment,
      }, token);
      setReviews((prev) => [newReview, ...prev]);
      setEligibleBooking(null);
      setSent(true);
      setRating(0);
      setComment('');
      setTimeout(() => setSent(false), 4000);
    } catch {
      setError(t('reviewError'));
    } finally {
      setSubmitting(false);
    }
  };

  const canReview = isSignedIn && eligibleBooking !== null;

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-line rounded-3xl p-6 md:p-8 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-text">{t('reviews')}</h2>
        {avgRating && (
          <div className="flex items-center gap-1 text-sm">
            <i className="fa-solid fa-star text-gold" />
            <span className="font-semibold text-text">{avgRating}</span>
            <span className="text-sub">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-sub py-4">{t('noReviews')}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {reviews.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl border border-line bg-white/60 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-text text-sm">{r.author.firstName} {r.author.lastName}</p>
                <p className="text-xs text-sub">{formatRelative(r.createdAt, t)}</p>
              </div>
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, s) => (
                  <i key={s} className={`fa-${s < r.rating ? 'solid' : 'regular'} fa-star text-gold text-xs`} />
                ))}
              </div>
              <p className="text-sm text-sub leading-relaxed">{r.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Review form */}
      <div className="mt-8 pt-6 border-t border-line">
        <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
          <i className="fa-solid fa-pen text-gold-dark text-sm" />
          {t('leaveReview')}
        </h3>

        {!isSignedIn ? (
          <div className="rounded-xl border border-line bg-bg px-4 py-3 text-sm text-sub">
            <a href={signInUrl} className="text-gold-dark hover:underline font-medium">{t('signInLink')}</a>{' '}{t('signInForReview')}
          </div>
        ) : !canReview ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <i className="fa-solid fa-lock mr-1.5" />
            {t('reviewEligibility')}
          </div>
        ) : sent ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <i className="fa-solid fa-circle-check" />
            {t('reviewThanks')}
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              {Array.from({ length: 5 }).map((_, s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s + 1)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s + 1)}
                  className="text-3xl transition-all duration-150 hover:scale-125">
                  <i className={`fa-${(hovered || rating) > s ? 'solid' : 'regular'} fa-star ${(hovered || rating) > s ? 'text-gold' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('reviewPlaceholder')}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm text-text bg-bg placeholder:text-sub outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition resize-none"
            />

            {error && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <i className="fa-solid fa-circle-exclamation" /> {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!comment.trim() || rating === 0 || submitting}
              className="mt-3 btn-gold rounded-full px-6 py-2.5 hover:scale-[1.03] transition disabled:opacity-50">
              {submitting
                ? <><i className="fa-solid fa-spinner fa-spin mr-2" />{t('reviewSubmitting')}</>
                : t('submitReview')
              }
            </button>
          </>
        )}
      </div>
    </div>
  );
}
