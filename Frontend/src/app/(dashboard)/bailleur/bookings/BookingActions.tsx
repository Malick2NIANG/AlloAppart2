'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { BookingStatus } from '@/types';
import { useToast } from '@/components/ui/Toast';

interface Props {
  bookingId: string;
  status: BookingStatus;
  onActionDone: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}

type Action = 'confirm' | 'cancel' | 'complete';

const ACTION_LABELS: Record<Action, string> = {
  confirm:  'Confirmer',
  cancel:   'Refuser',
  complete: 'Marquer terminé',
};

const ACTION_SUCCESS: Record<Action, string> = {
  confirm:  'Réservation confirmée',
  cancel:   'Réservation refusée',
  complete: 'Réservation marquée terminée',
};

export default function BookingActions({ bookingId, status, onActionDone, toast }: Props) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<Action | null>(null);

  const act = async (action: Action) => {
    setLoading(action);
    try {
      const token = await getToken();
      await api.patch(`/bookings/${bookingId}/${action}`, {}, token ?? undefined);
      toast.success(ACTION_SUCCESS[action]);
      onActionDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(null);
    }
  };

  const btn = (action: Action, className: string) => (
    <button
      key={action}
      onClick={() => act(action)}
      disabled={!!loading}
      className={`text-xs px-3 py-1.5 rounded-full font-medium transition disabled:opacity-50 ${className}`}
    >
      {loading === action
        ? <i className="fa-solid fa-spinner fa-spin" />
        : ACTION_LABELS[action]
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
        </>
      )}
      {(status === 'CANCELLED' || status === 'COMPLETED') && (
        <StatusChip status={status} />
      )}
    </div>
  );
}

function StatusChip({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING:   'bg-gold-pale text-gold-dark',
    CANCELLED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<BookingStatus, string> = {
    CONFIRMED: 'Confirmée',
    PENDING:   'En attente',
    CANCELLED: 'Refusée',
    COMPLETED: 'Terminée',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}
