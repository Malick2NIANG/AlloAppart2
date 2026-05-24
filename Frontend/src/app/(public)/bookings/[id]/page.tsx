'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Booking } from '@/types';
import Link from 'next/link';

function BookingResultContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const status = searchParams.get('status'); // "success" | "cancel"
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
      return;
    }
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const data = await api.get<Booking>(`/bookings/${id}`, token);
        setBooking(data);
      } catch {
      } finally {
        setLoading(false);
      }
    });
  }, [id, isSignedIn, getToken, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-gold-dark" />
      </div>
    );
  }

  const isSuccess = status === 'success' && booking?.status === 'CONFIRMED';
  const isCancelled = status === 'cancel' || booking?.status === 'CANCELLED';

  return (
    <div className="aa-container py-16 flex flex-col items-center text-center">

      {/* Icon */}
      <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
        <i className={`text-3xl ${isSuccess ? 'fa-solid fa-circle-check text-green-600' : 'fa-solid fa-circle-xmark text-red-500'}`} />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-text">
        {isSuccess ? 'Paiement confirmé !' : isCancelled ? 'Paiement annulé' : 'Statut du paiement'}
      </h1>
      <p className="mt-2 text-sub max-w-md">
        {isSuccess
          ? 'Votre réservation est confirmée. Le bailleur a été notifié et vous contactera prochainement.'
          : isCancelled
          ? 'Votre paiement a été annulé. Vous pouvez réessayer depuis vos réservations.'
          : 'Votre paiement est en cours de traitement. Vérifiez vos réservations dans quelques instants.'}
      </p>

      {/* Booking summary */}
      {booking && (
        <div className="mt-8 w-full max-w-sm rounded-2xl border border-line bg-card p-5 text-left">
          <p className="font-semibold text-text truncate">{booking.listing?.title ?? booking.listingId}</p>
          <p className="mt-1 text-sm text-sub">
            <i className="fa-regular fa-calendar text-gold-dark text-xs mr-1" />
            {formatDate(booking.startDate)}
            {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ''}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-sub">Montant</span>
            <span className="font-bold text-gold-dark">{formatPrice(booking.totalAmount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-sub">Statut</span>
            <StatusBadge status={booking.status} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link
          href="/locataire/bookings"
          className="btn-gold px-6"
        >
          <i className="fa-solid fa-calendar-check text-sm" />
          Mes réservations
        </Link>
        <Link
          href="/listings"
          className="rounded-xl border border-line bg-card px-6 py-2.5 text-sm font-medium text-sub hover:text-text transition-colors"
        >
          Continuer la recherche
        </Link>
      </div>
    </div>
  );
}

export default function BookingResultPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-gold-dark" />
      </div>
    }>
      <BookingResultContent />
    </Suspense>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING:   'bg-gold-pale text-gold-dark',
    CANCELLED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<string, string> = {
    CONFIRMED: 'Confirmée',
    PENDING:   'En attente',
    CANCELLED: 'Annulée',
    COMPLETED: 'Terminée',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status] ?? 'bg-card text-sub border border-line'}`}>
      {labels[status] ?? status}
    </span>
  );
}
