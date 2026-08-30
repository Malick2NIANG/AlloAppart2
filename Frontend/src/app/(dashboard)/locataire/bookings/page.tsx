'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Booking, BookingStatus } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const DISPUTE_WINDOW_HOURS = 24;

interface MyReview {
  id: string;
  bookingId: string;
  listingId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export default function LocataireBookingsPage() {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [myReviews,   setMyReviews]   = useState<MyReview[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [hasBailleur, setHasBailleur] = useState(true);

  /* Modals */
  const [reviewModal,       setReviewModal]       = useState<{ booking: Booking } | null>(null);
  const [cancellationModal, setCancellationModal] = useState<{ booking: Booking } | null>(null);
  const [disputeModal,      setDisputeModal]      = useState<{ booking: Booking } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const [data, me, reviews] = await Promise.all([
        api.get<Booking[]>('/bookings/mine', token),
        api.get<{ roles: string[] }>('/auth/me', token),
        api.get<MyReview[]>('/reviews/mine', token),
      ]);
      setBookings(data);
      setMyReviews(reviews);
      setHasBailleur(me.roles.some((r) => ['BAILLEUR', 'PRO_AGENCE', 'ADMIN'].includes(r)));
    } catch {
      setError(t('loadBookingsError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reviewedBookingIds = new Set(myReviews.map((r) => r.bookingId));

  const pending   = bookings.filter((b) => b.status === 'PENDING');
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED');
  const archived  = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'COMPLETED');

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonListRow key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={() => void fetchData()} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />{t('retryBtn')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('bookingsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">
          {t('bookingsCount', { count: bookings.length })}
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-gold-dark font-medium">
              <i className="fa-solid fa-circle text-[8px]" />
              {t('pendingCount', { count: pending.length })}
            </span>
          )}
        </p>
      </div>


      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">{t('noBookings')}</p>
          <p className="mt-1 text-sm text-sub">{t('noBookingsHint')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <Section
              title={t('sectionPending')}
              icon="fa-clock"
              accent="text-gold-dark"
              bookings={pending}
              reviewedBookingIds={reviewedBookingIds}
              onRefresh={fetchData}
              onReview={(b) => setReviewModal({ booking: b })}
            />
          )}
          {confirmed.length > 0 && (
            <Section
              title={t('sectionConfirmed')}
              icon="fa-circle-check"
              accent="text-green-600"
              bookings={confirmed}
              reviewedBookingIds={reviewedBookingIds}
              onRefresh={fetchData}
              onReview={(b) => setReviewModal({ booking: b })}
              onCancel={(b) => setCancellationModal({ booking: b })}
              onDispute={(b) => setDisputeModal({ booking: b })}
            />
          )}
          {archived.length > 0 && (
            <Section
              title={t('sectionArchived')}
              icon="fa-archive"
              accent="text-sub"
              bookings={archived}
              reviewedBookingIds={reviewedBookingIds}
              onRefresh={fetchData}
              onReview={(b) => setReviewModal({ booking: b })}
            />
          )}
        </div>
      )}

      {/* Modal annulation */}
      {cancellationModal && (
        <CancellationModal
          booking={cancellationModal.booking}
          onClose={() => setCancellationModal(null)}
          onSuccess={() => { setCancellationModal(null); void fetchData(); }}
        />
      )}

      {/* Modal signalement de non-conformité (Article 9 des CGU) */}
      {disputeModal && (
        <DisputeModal
          booking={disputeModal.booking}
          onClose={() => setDisputeModal(null)}
          onSuccess={() => { setDisputeModal(null); void fetchData(); }}
        />
      )}

      {/* Modal laisser un avis */}
      {reviewModal && (
        <ReviewModal
          booking={reviewModal.booking}
          onClose={() => setReviewModal(null)}
          onSuccess={() => { setReviewModal(null); void fetchData(); }}
        />
      )}
    </div>
  );
}

/* ─── Section ─────────────────────────────────────────────── */
function Section({
  title, icon, accent, bookings, reviewedBookingIds, onRefresh, onReview, onCancel, onDispute,
}: {
  title: string;
  icon: string;
  accent: string;
  bookings: Booking[];
  reviewedBookingIds: Set<string>;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
  onDispute?: (b: Booking) => void;
}) {
  return (
    <div>
      <h2 className={`flex items-center gap-2 text-sm font-semibold mb-3 ${accent}`}>
        <i className={`fa-solid ${icon} text-xs`} />
        {title} ({bookings.length})
      </h2>
      <div className="flex flex-col gap-3">
        {bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            alreadyReviewed={reviewedBookingIds.has(booking.id)}
            onRefresh={onRefresh}
            onReview={onReview}
            onCancel={onCancel}
            onDispute={onDispute}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── BookingCard ──────────────────────────────────────────── */
function BookingCard({
  booking, alreadyReviewed, onRefresh, onReview, onCancel, onDispute,
}: {
  booking: Booking;
  alreadyReviewed: boolean;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
  onDispute?: (b: Booking) => void;
}) {
  const router = useRouter();
  return (
    <div
      className="group rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-gold/40 transition-colors cursor-pointer"
      onClick={() => router.push(`/locataire/bookings/${booking.id}`)}
    >
      <div className="min-w-0">
        <p className="font-semibold text-text truncate group-hover:text-gold-dark transition-colors">
          {booking.listing?.title ?? booking.listingId}
        </p>
        <p className="text-sm text-sub mt-0.5">
          <i className="fa-regular fa-calendar text-gold-dark text-xs mr-1" />
          {formatDate(booking.startDate)}
          {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ''}
          <span className="mx-1.5">·</span>
          <span className="font-medium text-text">{formatPrice(booking.totalAmount)}</span>
        </p>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <LocataireBookingActions
          booking={booking}
          alreadyReviewed={alreadyReviewed}
          onRefresh={onRefresh}
          onReview={onReview}
          onCancel={onCancel}
          onDispute={onDispute}
        />
      </div>
    </div>
  );
}

/* ─── Actions ──────────────────────────────────────────────── */
function LocataireBookingActions({
  booking, alreadyReviewed, onRefresh, onReview, onCancel, onDispute,
}: {
  booking: Booking;
  alreadyReviewed: boolean;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
  onDispute?: (b: Booking) => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const { id: bookingId, status } = booking;
  const [payLoading,    setPayLoading]    = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  const handleDownloadPdf = async () => {
    const token = await getToken();
    if (!token) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('error');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recu-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('receiptError'));
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePay = async () => {
    const token = await getToken();
    if (!token) return;
    setPayLoading(true);
    setError(null);
    try {
      const { payment_url } = await api.post<{ payment_url: string }>(
        '/payments/initiate',
        { bookingId },
        token,
      );
      window.location.href = payment_url;
    } catch {
      setError(t('payError'));
      setPayLoading(false);
    }
  };

  const handleCancel = async () => {
    const token = await getToken();
    if (!token) return;
    setCancelLoading(true);
    setError(null);
    try {
      await api.patch(`/bookings/${bookingId}/cancel`, {}, token);
      onRefresh();
    } catch {
      setError(t('actionError'));
      setCancelLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {status === 'PENDING' && (
          <>
            <button
              onClick={handlePay}
              disabled={payLoading}
              className="btn-gold text-xs py-1.5 px-3 disabled:opacity-50"
            >
              {payLoading
                ? <i className="fa-solid fa-spinner fa-spin" />
                : <><i className="fa-solid fa-credit-card text-xs" /> {t('payBtn')}</>}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('cancelBtn')}
            </button>
          </>
        )}

        {(status === 'CONFIRMED' || status === 'CANCELLED' || status === 'COMPLETED') && (
          <StatusChip status={status as BookingStatus} />
        )}

        {/* Litige en cours — les fonds sont gelés en attente d'arbitrage admin */}
        {booking.escrowStatus === 'DISPUTED' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-1.5 px-3">
            <i className="fa-solid fa-hourglass-half text-[10px]" />
            {t('disputeInProgress')}
          </span>
        )}

        {/* Signalement de non-conformité — fenêtre de 24h après l'entrée dans les lieux */}
        {status === 'CONFIRMED' && booking.escrowStatus === 'HELD' && onDispute && (() => {
          const hoursSinceStart =
            (Date.now() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60);
          if (hoursSinceStart < 0 || hoursSinceStart > 24) return null; // hors fenêtre
          return (
            <button
              onClick={() => onDispute(booking)}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-300 rounded-lg py-1.5 px-3 transition-colors"
            >
              <i className="fa-solid fa-triangle-exclamation mr-1" />{t('reportDisputeBtn')}
            </button>
          );
        })()}

        {/* Annulation d'une réservation CONFIRMED — ouvre le modal avec politique */}
        {status === 'CONFIRMED' && booking.escrowStatus === 'HELD' && onCancel && (() => {
          const hoursUntilStart =
            (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
          if (hoursUntilStart < 0) return null; // séjour en cours → pas d'annulation
          return (
            <button
              onClick={() => onCancel(booking)}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('cancelBtn')}
            </button>
          );
        })()}

        {(status === 'CONFIRMED' || status === 'COMPLETED') && (
          <button
            onClick={() => void handleDownloadPdf()}
            disabled={pdfLoading}
            className="text-xs font-medium text-sub hover:text-gold-dark border border-line hover:border-gold/40 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
          >
            {pdfLoading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-file-pdf mr-1" />{t('receiptBtn')}</>}
          </button>
        )}

        {/* Bouton avis — uniquement sur COMPLETED */}
        {status === 'COMPLETED' && (
          alreadyReviewed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 px-3">
              <i className="fa-solid fa-star text-[10px]" />
              {t('reviewGiven')}
            </span>
          ) : (
            <button
              onClick={() => onReview(booking)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dark bg-gold-pale border border-gold/30 hover:border-gold hover:bg-gold/10 rounded-lg py-1.5 px-3 transition-all"
            >
              <i className="fa-solid fa-star text-[10px]" />
              {t('leaveReviewBtn')}
            </button>
          )
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── StatusChip ────────────────────────────────────────────── */
function StatusChip({ status }: { status: BookingStatus }) {
  const t = useTranslations('locataire');
  const styles: Record<BookingStatus, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING:   'bg-gold-pale text-gold-dark',
    CANCELLED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<BookingStatus, string> = {
    CONFIRMED: t('statusConfirmed'),
    PENDING:   t('statusPending'),
    CANCELLED: t('statusCancelled'),
    COMPLETED: t('statusCompleted'),
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

/* ─── Modal annulation ──────────────────────────────────────── */
function CancellationModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Calcul de la politique de remboursement (identique au backend)
  const hoursUntilStart =
    (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
  const fullRefund   = hoursUntilStart > 7 * 24;
  const refundAmount = fullRefund ? Number(booking.totalAmount) : 0;

  const handleConfirm = async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/bookings/${booking.id}/cancel`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      ).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? t('actionError'));
        }
      });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('actionError'));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">{t('cancelModalBadge')}</p>
            <h3 className="text-lg font-bold text-text mt-0.5 leading-tight line-clamp-2">
              {booking.listing?.title ?? t('cancelModalFallback')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sub text-sm" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4">
          {/* Politique */}
          <div className={`rounded-xl p-4 flex gap-3 ${fullRefund ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <i className={`fa-solid ${fullRefund ? 'fa-circle-check text-green-600' : 'fa-triangle-exclamation text-amber-500'} mt-0.5 text-sm shrink-0`} />
            <div>
              <p className={`text-sm font-semibold ${fullRefund ? 'text-green-700' : 'text-amber-700'}`}>
                {fullRefund ? t('fullRefundTitle') : t('noRefundTitle')}
              </p>
              <p className="text-xs text-sub mt-0.5">
                {fullRefund
                  ? t('fullRefundDesc', { amount: Number(booking.totalAmount).toLocaleString() })
                  : t('noRefundDesc')}
              </p>
              {fullRefund && refundAmount > 0 && (
                <p className="text-sm font-bold text-green-700 mt-1">
                  {t('refundAmount', { amount: refundAmount.toLocaleString() })}
                </p>
              )}
            </div>
          </div>

          <p className="text-sm text-sub">{t('cancelIrreversible')}</p>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation" />{error}
            </p>
          )}

          {/* Boutons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:bg-bg transition-colors"
            >
              {t('keepBtn')}
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={loading}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('confirmingBtn')}</>
                : <><i className="fa-solid fa-xmark" /> {t('confirmCancelBtn')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal signalement de non-conformité (Article 9 des CGU) ─ */
function DisputeModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [reason,     setReason]     = useState('');
  const [evidence,   setEvidence]   = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const hoursSinceStart =
    (Date.now() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60);
  const hoursLeft = Math.max(0, Math.ceil(DISPUTE_WINDOW_HOURS - hoursSinceStart));

  const handleSubmit = async () => {
    if (reason.trim().length < 10) { setError(t('disputeReasonTooShort')); return; }
    if (evidence.length === 0) { setError(t('disputeEvidenceRequired')); return; }
    setSubmitting(true);
    setError(null);
    const token = await getToken();
    if (!token) { setSubmitting(false); return; }
    try {
      await api.patch(`/bookings/${booking.id}/report-dispute`, {
        reason: reason.trim(),
        evidence,
      }, token);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('disputeSubmitError'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 p-5 flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide">{t('disputeModalBadge')}</p>
            <h3 className="text-lg font-bold text-text mt-0.5 leading-tight line-clamp-2">
              {booking.listing?.title ?? t('cancelModalFallback')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sub text-sm" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex gap-3">
            <i className="fa-solid fa-hourglass-half text-amber-500 mt-0.5 text-sm shrink-0" />
            <p className="text-xs text-amber-700">
              {t('disputeWindowHint', { hours: hoursLeft })}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sub mb-1.5">
              {t('disputeReasonLabel')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={t('disputeReasonPlaceholder')}
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-sub resize-none focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
            />
            <p className="text-right text-[11px] text-sub mt-1">{reason.length}/1000</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sub mb-1.5">
              {t('disputeEvidenceLabel')}
            </label>
            <ImageUploadZone images={evidence} onChange={setEvidence} getToken={getToken} />
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation" />{error}
            </p>
          )}
        </div>

        {/* Boutons */}
        <div className="p-5 pt-0 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:bg-bg transition-colors"
          >
            {t('keepBtn')}
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting
              ? <><i className="fa-solid fa-spinner fa-spin" /> {t('sendingBtn')}</>
              : <><i className="fa-solid fa-paper-plane" /> {t('disputeSubmitBtn')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal avis ────────────────────────────────────────────── */
function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="text-3xl transition-transform hover:scale-110 focus:outline-none"
        >
          <i className={`fa-star ${(hovered || value) >= n ? 'fa-solid text-gold' : 'fa-regular text-line'}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations('locataire');
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const RATING_LABELS = useMemo<Record<number, string>>(() => ({
    1: t('rating1'),
    2: t('rating2'),
    3: t('rating3'),
    4: t('rating4'),
    5: t('rating5'),
  }), [t]);

  const handleSubmit = async () => {
    if (rating === 0) { setError(t('selectRatingError')); return; }
    setSubmitting(true);
    setError(null);
    const token = await getToken();
    if (!token) { setSubmitting(false); return; }
    try {
      await api.post('/reviews', {
        bookingId: booking.id,
        listingId: booking.listingId,
        rating,
        comment: comment.trim() || undefined,
      }, token);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('reviewSendError'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-gold to-gold-light p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-900/70 uppercase tracking-wide">{t('yourReview')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-0.5 leading-tight line-clamp-2">
                {booking.listing?.title ?? t('reviewModalFallback')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="ml-3 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
            >
              <i className="fa-solid fa-xmark text-gray-900 text-sm" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-5">

          {/* Étoiles */}
          <div className="flex flex-col items-center gap-2 py-2">
            <StarRating value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-sm font-semibold text-gold-dark">{RATING_LABELS[rating]}</p>
            )}
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-xs font-semibold text-sub mb-1.5">
              {t('commentLabel')} <span className="font-normal">{t('commentOptional')}</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t('commentPlaceholder')}
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-sub resize-none focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
            />
            <p className="text-right text-[11px] text-sub mt-1">{comment.length}/2000</p>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation" />{error}
            </p>
          )}

          {/* Boutons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:bg-bg transition-colors"
            >
              {t('cancelBtn')}
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || rating === 0}
              className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-gray-900 hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('sendingBtn')}</>
                : <><i className="fa-solid fa-paper-plane" /> {t('publishReviewBtn')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
