'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Booking, BookingStatus } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SkeletonListRow } from '@/components/ui/Skeleton';

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
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [myReviews,   setMyReviews]   = useState<MyReview[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [hasBailleur, setHasBailleur] = useState(true);

  /* Modal avis */
  const [reviewModal, setReviewModal] = useState<{ booking: Booking } | null>(null);

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
      setError('Impossible de charger vos réservations.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

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
          <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Mes réservations</h1>
        <p className="mt-1 text-sm text-sub">
          {bookings.length} réservation{bookings.length > 1 ? 's' : ''}
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-gold-dark font-medium">
              <i className="fa-solid fa-circle text-[8px]" />
              {pending.length} en attente de paiement
            </span>
          )}
        </p>
      </div>

      {!hasBailleur && (
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold-pale p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20">
              <i className="fa-solid fa-house text-gold-dark" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Vous avez un bien à louer ?</p>
              <p className="text-xs text-sub">Publiez gratuitement — commission uniquement à la signature du bail</p>
            </div>
          </div>
          <Link href="/become-bailleur"
            className="btn-gold shrink-0 justify-center rounded-full px-5 py-2 text-xs font-bold sm:w-auto">
            Devenir bailleur
          </Link>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune réservation</p>
          <p className="mt-1 text-sm text-sub">Vos réservations apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <Section
              title="En attente de paiement"
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
              title="Confirmées"
              icon="fa-circle-check"
              accent="text-green-600"
              bookings={confirmed}
              reviewedBookingIds={reviewedBookingIds}
              onRefresh={fetchData}
              onReview={(b) => setReviewModal({ booking: b })}
            />
          )}
          {archived.length > 0 && (
            <Section
              title="Archivées"
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
  title, icon, accent, bookings, reviewedBookingIds, onRefresh, onReview,
}: {
  title: string;
  icon: string;
  accent: string;
  bookings: Booking[];
  reviewedBookingIds: Set<string>;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
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
          />
        ))}
      </div>
    </div>
  );
}

/* ─── BookingCard ──────────────────────────────────────────── */
function BookingCard({
  booking, alreadyReviewed, onRefresh, onReview,
}: {
  booking: Booking;
  alreadyReviewed: boolean;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-text truncate">
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
      <LocataireBookingActions
        booking={booking}
        alreadyReviewed={alreadyReviewed}
        onRefresh={onRefresh}
        onReview={onReview}
      />
    </div>
  );
}

/* ─── Actions ──────────────────────────────────────────────── */
function LocataireBookingActions({
  booking, alreadyReviewed, onRefresh, onReview,
}: {
  booking: Booking;
  alreadyReviewed: boolean;
  onRefresh: () => void;
  onReview: (b: Booking) => void;
}) {
  const { getToken } = useAuth();
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
      if (!res.ok) throw new Error('Erreur');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recu-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Impossible de télécharger le reçu.');
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
      setError('Erreur de paiement. Réessayez.');
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
      setError('Erreur. Réessayez.');
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
                : <><i className="fa-solid fa-credit-card text-xs" /> Payer</>}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Annuler'}
            </button>
          </>
        )}

        {(status === 'CONFIRMED' || status === 'CANCELLED' || status === 'COMPLETED') && (
          <StatusChip status={status} />
        )}

        {(status === 'CONFIRMED' || status === 'COMPLETED') && (
          <button
            onClick={() => void handleDownloadPdf()}
            disabled={pdfLoading}
            className="text-xs font-medium text-sub hover:text-gold-dark border border-line hover:border-gold/40 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-50"
            title="Télécharger le reçu PDF"
          >
            {pdfLoading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-file-pdf mr-1" />Reçu</>}
          </button>
        )}

        {/* Bouton avis — uniquement sur COMPLETED */}
        {status === 'COMPLETED' && (
          alreadyReviewed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 px-3">
              <i className="fa-solid fa-star text-[10px]" />
              Avis donné
            </span>
          ) : (
            <button
              onClick={() => onReview(booking)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dark bg-gold-pale border border-gold/30 hover:border-gold hover:bg-gold/10 rounded-lg py-1.5 px-3 transition-all"
            >
              <i className="fa-solid fa-star text-[10px]" />
              Laisser un avis
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
  const styles: Record<BookingStatus, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING:   'bg-gold-pale text-gold-dark',
    CANCELLED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<BookingStatus, string> = {
    CONFIRMED: 'Confirmée',
    PENDING:   'En attente',
    CANCELLED: 'Annulée',
    COMPLETED: 'Terminée',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
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

const RATING_LABELS: Record<number, string> = {
  1: 'Très décevant',
  2: 'Décevant',
  3: 'Correct',
  4: 'Bien',
  5: 'Excellent',
};

function ReviewModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) { setError('Veuillez sélectionner une note.'); return; }
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
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'envoi. Réessayez.');
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
              <p className="text-xs font-semibold text-gray-900/70 uppercase tracking-wide">Votre avis</p>
              <h3 className="text-lg font-bold text-gray-900 mt-0.5 leading-tight line-clamp-2">
                {booking.listing?.title ?? 'Logement'}
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
              Commentaire <span className="font-normal">(optionnel)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Décrivez votre expérience : emplacement, propreté, communication avec le bailleur…"
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
              Annuler
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || rating === 0}
              className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-gray-900 hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting
                ? <><i className="fa-solid fa-spinner fa-spin" /> Envoi…</>
                : <><i className="fa-solid fa-paper-plane" /> Publier l&apos;avis</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
