'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Props {
  overdueVerifications: number;
  expiringSubscriptions: number;
  suspendedListings: number;
}

export function DismissibleAlerts({ overdueVerifications, expiringSubscriptions, suspendedListings }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = (key: string) => setDismissed((prev) => new Set([...prev, key]));

  const alerts = [
    overdueVerifications > 0 && !dismissed.has('verif') && {
      key: 'verif',
      href: '/espace/verifications',
      icon: 'fa-solid fa-shield-halved',
      label: `${overdueVerifications} vérif${overdueVerifications > 1 ? 's' : ''} >24h sans traitement`,
    },
    expiringSubscriptions > 0 && !dismissed.has('sub') && {
      key: 'sub',
      href: '/espace/subscriptions',
      icon: 'fa-solid fa-id-card',
      label: `${expiringSubscriptions} abonnement${expiringSubscriptions > 1 ? 's' : ''} expirant dans 7 j`,
    },
    suspendedListings > 0 && !dismissed.has('suspended') && {
      key: 'suspended',
      href: '/espace/listings?status=SUSPENDED',
      icon: 'fa-solid fa-house-circle-xmark',
      label: `${suspendedListings} annonce${suspendedListings > 1 ? 's' : ''} suspendue${suspendedListings > 1 ? 's' : ''}`,
    },
  ].filter(Boolean) as { key: string; href: string; icon: string; label: string }[];

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="mb-3 flex items-center gap-2">
        <i className="fa-solid fa-triangle-exclamation text-amber-600" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Points d&apos;attention</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {alerts.map((alert) => (
          <div key={alert.key} className="flex items-center rounded-xl border border-amber-200 bg-white dark:border-amber-900/40 dark:bg-amber-950/30">
            <Link
              href={alert.href}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300"
            >
              <i className={alert.icon} />
              {alert.label}
            </Link>
            <button
              onClick={() => dismiss(alert.key)}
              className="pr-2.5 text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 transition-colors"
              title="Fermer"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
