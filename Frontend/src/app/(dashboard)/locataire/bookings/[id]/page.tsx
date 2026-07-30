'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Booking } from '@/types';

interface MyReview {
  id: string;
  bookingId: string;
  rating: number;
  comment?: string | null;
}

const STATUS_CLS: Record<string, string> = {
  PENDING:   'bg-gold-pale text-gold-dark border-gold/30',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const ESCROW_CLS: Record<string, string> = {
  AWAITING_PAYMENT: 'bg-gold-pale text-gold-dark border-gold/30',
  HELD:             'bg-blue-50 text-blue-700 border-blue-200',
  RELEASED:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  REFUNDED:         'bg-red-50 text-red-600 border-red-200',
};

const ESCROW_ICON: Record<string, string> = {
  AWAITING_PAYMENT: 'fa-clock',
  HELD:             'fa-shield-halved',
  RELEASED:         'fa-circle-check',
  REFUNDED:         'fa-rotate-left',
};

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { getToken } = useAuth();
  const t = useTranslations('locataire');

  const STATUS_LABEL: Record<string, string> = {
    PENDING:   t('statusPending'),
    CONFIRMED: t('statusConfirmed'),
    CANCELLED: t('statusCancelled'),
    COMPLETED: t('statusCompleted'),
  };

  const ESCROW_LABEL: Record<string, string> = {
    AWAITING_PAYMENT: t('escrowAwaiting'),
    HELD:             t('escrowHeld'),
    RELEASED:         t('escrowReleased'),
    REFUNDED:         t('escrowRefunded'),
  };

  const [booking,   setBooking]   = useState<Booking | null>(null);
  const [myReview,  setMyReview]  = useState<MyReview | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  /* Review modal */
  const [showReview,    setShowReview]    = useState(false);
  const [reviewRating,  setReviewRating]  = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving,  setReviewSaving]  = useState(false);
  const [reviewFlash,   setReviewFlash]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const [bk, reviews] = await Promise.all([
        api.get<Booking>(`/bookings/${id}`, token),
        api.get<MyReview[]>('/reviews/mine', token).catch(() => []),
      ]);
      setBooking(bk);
      setMyReview(reviews.find((r) => r.bookingId === id) ?? null);
    } catch {
      setError(t('detailLoadError'));
    } finally {
      setLoading(false);
    }
  }, [id, getToken, t]);

  useEffect(() => { void load(); }, [load]);

  const cancel = async () => {
    if (!booking || canceling) return;
    setCanceling(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.patch(`/bookings/${booking.id}/cancel`, {}, token);
      await load();
    } catch {
      setError(t('cancelBookingError'));
    } finally {
      setCanceling(false);
    }
  };

  const submitReview = async () => {
    if (reviewRating === 0 || !booking) return;
    setReviewSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post('/reviews', {
        bookingId:  booking.id,
        listingId:  booking.listingId,
        rating:     reviewRating,
        comment:    reviewComment.trim() || undefined,
      }, token);
      setReviewFlash(t('reviewPublished'));
      setShowReview(false);
      await load();
    } catch {
      setReviewFlash(t('reviewPublishError'));
    } finally {
      setReviewSaving(false);
      setTimeout(() => setReviewFlash(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-line bg-card h-24" />
        ))}
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error ?? t('notFoundMsg')}</p>
        <Link href="/locataire/bookings" className="mt-4 btn-gold text-sm">
          {t('backToBookings')}
        </Link>
      </div>
    );
  }

  const listing     = booking.listing;
  const canCancel   = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const canReview   = booking.status === 'COMPLETED' && !myReview;
  const nights      = booking.endDate
    ? Math.ceil((new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-sub">
        <Link href="/locataire/bookings" className="hover:text-gold-dark transition-colors">
          {t('breadcrumbBookings')}
        </Link>
        <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
        <span className="text-text font-medium truncate max-w-[200px]">
          {listing?.title ?? booking.listingId}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text">
            {listing?.title ?? t('bookingTitleFallback')}
          </h1>
          {listing?.city && (
            <p className="text-sm text-sub mt-0.5">
              <i className="fa-solid fa-location-dot text-xs mr-1 text-gold-dark" />
              {listing.city}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_CLS[booking.status] ?? 'bg-card text-sub border-line'}`}>
          {STATUS_LABEL[booking.status] ?? booking.status}
        </span>
      </div>

      {/* Infos séjour */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text flex items-center gap-2">
          <i className="fa-regular fa-calendar text-gold-dark text-xs" />
          {t('stayDetails')}
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-sub font-semibold mb-1">{t('arrivalLabel')}</p>
            <p className="font-medium text-text">{formatDate(booking.startDate)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-sub font-semibold mb-1">{t('departureLabel')}</p>
            <p className="font-medium text-text">
              {booking.endDate ? formatDate(booking.endDate) : '—'}
            </p>
          </div>
          {nights != null && (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-widest text-sub font-semibold mb-1">{t('durationLabel')}</p>
              <p className="font-medium text-text">{t('nightsCount', { count: nights })}</p>
            </div>
          )}
        </div>
        {listing && (
          <div className="pt-3 border-t border-line flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-house text-gold-dark text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">{listing.title}</p>
              <p className="text-xs text-sub">{listing.city}</p>
            </div>
            <Link
              href={`/listings/${listing.id}`}
              className="ml-auto shrink-0 text-xs text-gold-dark hover:underline"
            >
              {t('viewListingLink')} <i className="fa-solid fa-arrow-right text-[10px]" />
            </Link>
          </div>
        )}
      </div>

      {/* Paiement */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text flex items-center gap-2">
          <i className="fa-solid fa-wallet text-gold-dark text-xs" />
          {t('paymentSection')}
        </h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-sub">{t('totalAmountLabel')}</span>
          <span className="font-bold text-gold-dark text-base">{formatPrice(booking.totalAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-sub">{t('paymentStatusLabel')}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${ESCROW_CLS[booking.escrowStatus] ?? 'bg-card text-sub border-line'}`}>
            <i className={`fa-solid ${ESCROW_ICON[booking.escrowStatus] ?? 'fa-circle'} text-[10px]`} />
            {ESCROW_LABEL[booking.escrowStatus] ?? booking.escrowStatus}
          </span>
        </div>
        {booking.paymentRef && (
          <div className="flex items-center justify-between text-sm pt-1 border-t border-line">
            <span className="text-sub">{t('paymentRefLabel')}</span>
            <span className="font-mono text-xs text-sub">{booking.paymentRef}</span>
          </div>
        )}
        <div className="pt-1">
          <Link
            href={`/bookings/${booking.id}?status=success`}
            className="text-xs text-gold-dark hover:underline flex items-center gap-1"
          >
            <i className="fa-solid fa-file-pdf text-[11px]" />
            {t('viewReceiptLink')}
          </Link>
        </div>
      </div>

      {/* Avis déjà posté */}
      {myReview && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold text-emerald-800 flex items-center gap-2 mb-3">
            <i className="fa-solid fa-star text-xs" />
            {t('yourReviewSection')}
          </h2>
          <div className="flex items-center gap-1 mb-1">
            {[1,2,3,4,5].map((s) => (
              <i key={s} className={`fa-solid fa-star text-sm ${s <= myReview.rating ? 'text-gold-dark' : 'text-emerald-200'}`} />
            ))}
          </div>
          {myReview.comment && (
            <p className="text-sm text-emerald-800 mt-1">{myReview.comment}</p>
          )}
        </div>
      )}

      {/* Flash review */}
      {reviewFlash && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <i className="fa-solid fa-circle-check" />
          {reviewFlash}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {canReview && !showReview && (
          <button
            onClick={() => setShowReview(true)}
            className="btn-gold text-sm"
          >
            <i className="fa-solid fa-star mr-1.5" />
            {t('leaveReviewAction')}
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => void cancel()}
            disabled={canceling}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition disabled:opacity-50"
          >
            {canceling
              ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />{t('cancelingAction')}</>
              : <><i className="fa-solid fa-xmark mr-1.5" />{t('cancelReservationBtn')}</>
            }
          </button>
        )}
        <Link
          href="/locataire/bookings"
          className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium text-sub hover:text-text transition"
        >
          {t('backToListBtn')}
        </Link>
      </div>

      {/* Formulaire avis inline */}
      {showReview && (
        <div className="rounded-2xl border border-gold/30 bg-gold-pale p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gold-dark flex items-center gap-2">
            <i className="fa-solid fa-star text-xs" />
            {t('reviewFormTitle')}
          </h2>
          <div className="flex items-center gap-2">
            {[1,2,3,4,5].map((s) => (
              <button key={s} onClick={() => setReviewRating(s)} type="button">
                <i className={`fa-solid fa-star text-2xl transition ${s <= reviewRating ? 'text-gold-dark' : 'text-gold/30 hover:text-gold'}`} />
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder={t('reviewCommentPh')}
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void submitReview()}
              disabled={reviewRating === 0 || reviewSaving}
              className="btn-gold text-sm disabled:opacity-50"
            >
              {reviewSaving
                ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />{t('publishingBtn')}</>
                : <><i className="fa-solid fa-paper-plane mr-1.5" />{t('publishBtn')}</>
              }
            </button>
            <button
              onClick={() => { setShowReview(false); setReviewRating(0); setReviewComment(''); }}
              className="rounded-xl border border-line bg-card px-4 py-2 text-sm text-sub hover:text-text transition"
            >
              {t('cancelBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
