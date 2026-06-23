'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';

type AlertLevel = 'ok' | 'warning' | 'critical' | 'expired' | 'none';

interface AlertData {
  daysLeft: number | null;
  level: AlertLevel;
}

const ALERT_CONFIG: Record<
  Exclude<AlertLevel, 'ok' | 'none'>,
  { bg: string; border: string; icon: string; iconColor: string; text: string; btnClass: string }
> = {
  warning: {
    bg:        'bg-amber-50',
    border:    'border-amber-200',
    icon:      'fa-solid fa-triangle-exclamation',
    iconColor: 'text-amber-500',
    text:      'text-amber-800',
    btnClass:  'bg-amber-600 hover:bg-amber-700 text-white',
  },
  critical: {
    bg:        'bg-orange-50',
    border:    'border-orange-300',
    icon:      'fa-solid fa-clock',
    iconColor: 'text-orange-500',
    text:      'text-orange-900',
    btnClass:  'bg-orange-600 hover:bg-orange-700 text-white',
  },
  expired: {
    bg:        'bg-red-50',
    border:    'border-red-300',
    icon:      'fa-solid fa-circle-exclamation',
    iconColor: 'text-red-500',
    text:      'text-red-900',
    btnClass:  'bg-red-600 hover:bg-red-700 text-white',
  },
};

export default function SubscriptionAlert() {
  const { getToken } = useAuth();
  const [alert, setAlert]       = useState<AlertData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

    getToken().then(async (token) => {
      if (!token) return;
      try {
        const res = await fetch(`${API}/subscriptions/me/alert`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as AlertData;
          setAlert(data);
        }
      } catch { /* silencieux */ }
    });
  }, [getToken]);

  // Ne rien afficher si : pas de données, niveau ok/none, ou bannière fermée
  if (!alert || alert.level === 'ok' || alert.level === 'none') return null;
  if (dismissed && alert.level === 'warning') return null; // critiques et expirés non fermables

  const config = ALERT_CONFIG[alert.level];

  const message = () => {
    if (alert.level === 'expired') {
      return 'Votre abonnement a expiré. Vos annonces sont suspendues jusqu\'au renouvellement.';
    }
    if (alert.level === 'critical') {
      return `Votre abonnement expire dans ${alert.daysLeft} jour${alert.daysLeft === 1 ? '' : 's'}. Renouvelez maintenant pour éviter toute interruption.`;
    }
    return `Votre abonnement expire dans ${alert.daysLeft} jours.`;
  };

  return (
    <div className={`w-full border-b ${config.bg} ${config.border}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <i className={`${config.icon} ${config.iconColor} shrink-0 text-sm`} />
          <p className={`text-sm font-medium ${config.text} truncate`}>
            {message()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/bailleur/abonnement"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${config.btnClass}`}
          >
            Renouveler
          </Link>
          {alert.level === 'warning' && (
            <button
              onClick={() => setDismissed(true)}
              className={`${config.text} opacity-60 hover:opacity-100 transition`}
              aria-label="Fermer"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
