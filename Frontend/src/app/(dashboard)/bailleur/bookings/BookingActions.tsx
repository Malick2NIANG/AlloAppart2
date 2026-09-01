'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { BookingStatus } from '@/types';
import { useToast } from '@/components/ui/Toast';

interface Props {
  bookingId: string;
  status: BookingStatus;
  onActionDone: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}

type Action = 'confirm' | 'cancel' | 'complete' | 'approve' | 'reject' | 'terminate-lease';

export default function BookingActions({ bookingId, status, onActionDone, toast }: Props) {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const [loading, setLoading] = useState<Action | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  const ACTION_LABELS: Record<Action, string> = {
    confirm:  t('actionConfirm'),
    cancel:   t('actionCancelBooking'),
    complete: t('actionComplete'),
    approve:  t('actionApprove'),
    reject:   t('actionReject'),
    'terminate-lease': t('actionTerminateLease'),
  };

  const ACTION_SUCCESS: Record<Action, string> = {
    confirm:  t('actionConfirmSuccess'),
    cancel:   t('actionCancelSuccess'),
    complete: t('actionCompleteSuccess'),
    approve:  t('actionApproveSuccess'),
    reject:   t('actionRejectSuccess'),
    'terminate-lease': t('actionTerminateLeaseSuccess'),
  };

  const act = async (action: Action, successMessage?: string) => {
    setLoading(action);
    try {
      const token = await getToken();
      await api.patch(`/bookings/${bookingId}/${action}`, {}, token ?? undefined);
      toast.success(successMessage ?? ACTION_SUCCESS[action]);
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
          {btn('confirm',  'bg-green-100 text-green-700 hover:bg-green-200')}
          {btn('cancel',   'bg-red-100 text-red-700 hover:bg-red-200')}
        </>
      )}
      {status === 'CONFIRMED' && (
        <>
          <StatusChip status={status} />
          {btn('complete', 'bg-blue-100 text-blue-700 hover:bg-blue-200')}
          {/* "cancel" hits the same PATCH /bookings/:id/cancel as the PENDING "Refuser"
              button above, but "Refuser" reads wrong once a booking is already confirmed —
              use distinct "Annuler" wording and success message for this context. */}
          {btn('cancel',   'bg-red-100 text-red-700 hover:bg-red-200', t('actionCancelConfirmed'), t('actionCancelConfirmedSuccess'))}
        </>
      )}
      {(status === 'CANCELLED' || status === 'COMPLETED') && (
        <StatusChip status={status} />
      )}

      {/* Demande de location au mois — à approuver ou refuser */}
      {status === 'REQUESTED' && (
        <>
          {btn('approve', 'bg-green-100 text-green-700 hover:bg-green-200')}
          {btn('reject',  'bg-red-100 text-red-700 hover:bg-red-200')}
        </>
      )}

      {/* Approuvée — en attente du paiement du ticket d'entrée par le locataire */}
      {status === 'APPROVED' && <StatusChip status={status} />}

      {/* Bail actif — le bailleur peut le résilier à tout moment */}
      {status === 'ACTIVE' && (
        confirmTerminate ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-sub">{t('confirmTerminateLease')}</span>
            {btn('terminate-lease', 'bg-red-100 text-red-700 hover:bg-red-200', t('actionTerminateLeaseConfirm'))}
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
              className="text-xs px-3 py-1.5 rounded-full font-medium bg-red-100 text-red-700 hover:bg-red-200 transition"
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

function StatusChip({ status }: { status: BookingStatus }) {
  const t = useTranslations('bailleur');

  const map: Record<BookingStatus, string> = {
    CONFIRMED:  'bg-green-100 text-green-700',
    PENDING:    'bg-gold-pale text-gold-dark',
    CANCELLED:  'bg-red-100 text-red-700',
    COMPLETED:  'bg-blue-100 text-blue-700',
    // Cycle de vie du bail mensuel (location hybride)
    REQUESTED:  'bg-gold-pale text-gold-dark',
    APPROVED:   'bg-green-100 text-green-700',
    REJECTED:   'bg-red-100 text-red-700',
    ACTIVE:     'bg-emerald-100 text-emerald-700',
    TERMINATED: 'bg-gray-100 text-gray-600',
  };

  const labels: Record<BookingStatus, string> = {
    CONFIRMED:  t('chipConfirmed'),
    PENDING:    t('chipPending'),
    CANCELLED:  t('chipCancelled'),
    COMPLETED:  t('chipCompleted'),
    REQUESTED:  t('chipRequested'),
    APPROVED:   t('chipApproved'),
    REJECTED:   t('chipRejected'),
    ACTIVE:     t('chipActive'),
    TERMINATED: t('chipTerminated'),
  };

  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}
