'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

interface Subscription {
  id: string;
  plan: 'STARTER' | 'PRO';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  monthlyFee: number | string;
  startDate: string;
  endDate: string | null;
}

const PLANS = [
  {
    key: 'STARTER' as const,
    name: 'Starter',
    price: '10 000',
    listings: '10 annonces max',
    features: ['10 annonces actives', 'Messagerie intégrée', 'Tableau de bord', 'Support email'],
  },
  {
    key: 'PRO' as const,
    name: 'Pro',
    price: '25 000',
    listings: 'Annonces illimitées',
    features: ['Annonces illimitées', 'Messagerie intégrée', 'Analytiques avancées', 'Support prioritaire', 'Badge agence vérifiée'],
    highlighted: true,
  },
];

export default function AbonnementPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const [subscription, setSubscription]  = useState<Subscription | null>(null);
  const [loading, setLoading]            = useState(true);
  const [initiating, setInitiating]      = useState<string | null>(null);
  const [cancelling, setCancelling]      = useState(false);
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSubscription = useCallback(async () => {
    try {
      const token = await getToken();
      const res   = await fetch(`${API}/subscriptions/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as Subscription;
        setSubscription(data);
      } else {
        setSubscription(null);
      }
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, API]);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') showToast('success', 'Paiement reçu — votre abonnement sera activé dans quelques instants.');
    if (status === 'cancel')  showToast('error',   'Paiement annulé.');
  }, [searchParams]);

  const initiate = async (plan: 'STARTER' | 'PRO') => {
    setInitiating(plan);
    try {
      const token = await getToken();
      const res   = await fetch(`${API}/subscriptions/initiate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        showToast('error', err.message ?? 'Erreur lors de l\'initiation du paiement.');
        return;
      }
      const { payment_url } = await res.json() as { payment_url: string };
      window.location.href = payment_url;
    } catch {
      showToast('error', 'Service de paiement indisponible.');
    } finally {
      setInitiating(null);
    }
  };

  const cancel = async () => {
    if (!confirm('Annuler votre abonnement ?')) return;
    setCancelling(true);
    try {
      const token = await getToken();
      const res   = await fetch(`${API}/subscriptions/cancel`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('success', 'Abonnement annulé.');
        await fetchSubscription();
      } else {
        showToast('error', 'Erreur lors de l\'annulation.');
      }
    } catch {
      showToast('error', 'Erreur réseau.');
    } finally {
      setCancelling(false);
    }
  };

  const statusLabel: Record<string, string> = {
    ACTIVE:    'Actif',
    SUSPENDED: 'En attente',
    CANCELLED: 'Annulé',
  };
  const statusColor: Record<string, string> = {
    ACTIVE:    'text-green-700 bg-green-50 border-green-200',
    SUSPENDED: 'text-amber-700 bg-amber-50 border-amber-200',
    CANCELLED: 'text-red-700   bg-red-50   border-red-200',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg border ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      <h1 className="text-2xl font-bold text-text mb-1">Abonnement</h1>
      <p className="text-sub text-sm mb-8">Choisissez le plan adapté à votre activité.</p>

      {/* Abonnement actuel */}
      {!loading && subscription && subscription.status !== 'CANCELLED' && (
        <div className="mb-8 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-sub font-medium uppercase tracking-wide mb-1">Abonnement actuel</p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-text">{subscription.plan}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColor[subscription.status] ?? ''}`}>
                  {statusLabel[subscription.status] ?? subscription.status}
                </span>
              </div>
              <p className="text-sm text-sub mt-1">
                {Number(subscription.monthlyFee).toLocaleString('fr-FR')} FCFA / mois
                {subscription.endDate && ` — expire le ${new Date(subscription.endDate).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
            {subscription.status === 'ACTIVE' && (
              <button
                onClick={() => void cancel()}
                disabled={cancelling}
                className="text-xs text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition disabled:opacity-50"
              >
                {cancelling ? 'Annulation…' : 'Annuler l\'abonnement'}
              </button>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-gold" />
        </div>
      )}

      {/* Plans */}
      {!loading && (
        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => {
            const isActive  = subscription?.plan === plan.key && subscription.status === 'ACTIVE';
            const isCurrent = subscription?.plan === plan.key && subscription.status !== 'CANCELLED';
            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-6 transition ${
                  plan.highlighted
                    ? 'border-gold bg-gold-pale/30 shadow-md'
                    : 'border-line bg-card'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 text-xs font-bold text-gray-900">
                    Populaire
                  </span>
                )}
                <h2 className="text-lg font-bold text-text">{plan.name}</h2>
                <p className="mt-1 text-3xl font-extrabold text-text">
                  {plan.price} <span className="text-base font-medium text-sub">FCFA/mois</span>
                </p>
                <p className="mt-1 text-sm text-sub">{plan.listings}</p>

                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text">
                      <i className="fa-solid fa-check text-gold-dark text-xs" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => void initiate(plan.key)}
                  disabled={isActive || initiating !== null}
                  className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : plan.highlighted
                        ? 'btn-gold'
                        : 'border border-line bg-white text-text hover:bg-gold-pale hover:text-gold-dark'
                  }`}
                >
                  {initiating === plan.key ? (
                    <><i className="fa-solid fa-spinner fa-spin mr-2" />Redirection…</>
                  ) : isActive ? (
                    <><i className="fa-solid fa-check mr-1" />Plan actif</>
                  ) : isCurrent ? (
                    'Renouveler'
                  ) : (
                    'Choisir ce plan'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-sub text-center">
        Paiement sécurisé via PayDunya · Résiliation à tout moment
      </p>
    </div>
  );
}
