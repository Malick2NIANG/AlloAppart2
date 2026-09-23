'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { Booking, BookingStatus } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { StatusChip } from '@/components/bookings/StatusChip';

interface Props {
  bookingId: string;
  status: BookingStatus;
  // Préavis de résiliation en cours (bail ACTIVE uniquement) — voir
  // BookingsService.terminateLease côté backend.
  terminationEffectiveAt?: string | null;
  terminationRequestedByTenant?: boolean;
  onActionDone: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}

type Action = 'confirm' | 'cancel' | 'complete' | 'approve' | 'reject' | 'terminate-lease' | 'cancel-terminate-lease';

export default function BookingActions({
  bookingId, status, terminationEffectiveAt, terminationRequestedByTenant, onActionDone, toast,
}: Props) {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const locale = useLocale();
  const [loading, setLoading] = useState<Action | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  const ACTION_LABELS: Record<Action, string> = {
    confirm:  t('actionConfirm'),
    cancel:   t('actionCancelBooking'),
    complete: t('actionComplete'),
    approve:  t('actionApprove'),
    reject:   t('actionReject'),
    'terminate-lease': t('actionTerminateLease'),
    'cancel-terminate-lease': t('actionCancelTermination'),
  };

  const ACTION_SUCCESS: Record<Action, string> = {
    confirm:  t('actionConfirmSuccess'),
    cancel:   t('actionCancelSuccess'),
    complete: t('actionCompleteSuccess'),
    approve:  t('actionApproveSuccess'),
    reject:   t('actionRejectSuccess'),
    'terminate-lease': t('actionTerminateLeaseSuccess'),
    'cancel-terminate-lease': t('actionCancelTerminationSuccess'),
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

  const act = async (action: Action, successMessage?: string) => {
    setLoading(action);
    try {
      const token = await getToken();
      const result = await api.patch<Booking>(`/bookings/${bookingId}/${action}`, {}, token ?? undefined);
      // "Résilier le bail" ne résilie plus immédiatement (préavis de 30j) —
      // le message de succès doit refléter la date d'effet réellement
      // renvoyée par le backend plutôt que le texte statique générique.
      if (action === 'terminate-lease' && result.terminationEffectiveAt) {
        toast.success(t('actionTerminateLeaseScheduledSuccess', { date: formatDate(result.terminationEffectiveAt) }));
      } else {
        toast.success(successMessage ?? ACTION_SUCCESS[action]);
      }
      onActionDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('actionError'));
    } finally {
      setLoading(null);
    }
  };

  const btn = (action: Action, className: string, labelOverride?: string, successMessage?: string) => (
    <button
      key={action}
      onClick={() => act(action, successMessage)}
      disabled={!!loading}
      className={`text-xs px-3 py-1.5 rounded-full font-medium transition disabled:opacity-50 ${className}`}
    >
      {loading === action
        ? <i className="fa-solid fa-spinner fa-spin" />
        : (labelOverride ?? ACTION_LABELS[action])
      }
    </button>
  );

  return (
    <div className="flex items-end gap-2 shrink-0 flex-wrap">
      {status === 'PENDING' && (
        <>
          {btn('confirm',  'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-200')}
          {btn('cancel',   'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200')}
        </>
      )}
      {status === 'CONFIRMED' && (
        <>
          <StatusChip status={status} />
          {btn('complete', 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-200')}
          {/* "cancel" hits the same PATCH /bookings/:id/cancel as the PENDING "Refuser"
              button above, but "Refuser" reads wrong once a booking is already confirmed —
              use distinct "Annuler" wording and success message for this context. */}
          {btn('cancel',   'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200', t('actionCancelConfirmed'), t('actionCancelConfirmedSuccess'))}
        </>
      )}
      {(status === 'CANCELLED' || status === 'COMPLETED') && (
        <StatusChip status={status} />
      )}

      {/* Demande de location au mois — à approuver ou refuser */}
      {status === 'REQUESTED' && (
        <>
          {btn('approve', 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-200')}
          {btn('reject',  'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200')}
        </>
      )}

      {/* Approuvée — en attente du paiement du ticket d'entrée par le locataire */}
      {status === 'APPROVED' && <StatusChip status={status} />}

      {/* Bail actif — le bailleur peut déclencher un préavis de résiliation
          (30j) à tout moment, ou l'annuler si déjà en cours. */}
      {status === 'ACTIVE' && (
        terminationEffectiveAt ? (
          <div className="flex flex-col items-start gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <i className="fa-solid fa-hourglass-half text-[10px]" />
              {t('terminationScheduledNotice', { date: formatDate(terminationEffectiveAt) })}
              {terminationRequestedByTenant && ` · ${t('terminationRequestedByOther')}`}
            </span>
            {btn('cancel-terminate-lease', 'bg-bg text-sub border border-line hover:bg-line/30')}
          </div>
        ) : confirmTerminate ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-sub">{t('confirmTerminateLease')}</span>
            {btn('terminate-lease', 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200', t('actionTerminateLeaseConfirm'))}
            <button
              onClick={() => setConfirmTerminate(false)}
              className="text-xs px-3 py-1.5 rounded-full font-medium bg-bg text-sub border border-line hover:bg-line/30 transition"
            >
              {t('actionCancelTerminate')}
            </button>
          </div>
        ) : (
          <>
            <StatusChip status={status} />
            <button
              onClick={() => setConfirmTerminate(true)}
              className="text-xs px-3 py-1.5 rounded-full font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 transition"
            >
              {t('actionTerminateLease')}
            </button>
          </>
        )
      )}

      {(status === 'REJECTED' || status === 'TERMINATED') && (
        <StatusChip status={status} />
      )}
    </div>
  );
}
