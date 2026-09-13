'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { openPaymentTab, redirectPaymentTab, closePaymentTab } from '@/lib/utils';

interface Subscription {
  id: string;
  plan: 'STARTER' | 'PRO';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  monthlyFee: number | string;
  startDate: string;
  endDate: string | null;
}

function AbonnementContent() {
  const { getToken } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const t            = useTranslations('bailleur');
  const locale       = useLocale();
  const numLocale    = locale === 'en' ? 'en-US' : 'fr-FR';

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading]           = useState(true);
  const [initiating, setInitiating]     = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan]   = useState<typeof PLANS[number] | null>(null);
  const [toast, setToast]              = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [polling, setPolling]          = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  // Plans defined with translations — must be inside the component
  const PLANS = [
    {
      key: 'STARTER' as const,
      name: 'Starter',
      price: '75 000',
      listings: t('planStarterListings'),
      features: [t('planStarterFeature1'), t('planStarterFeature2'), t('planStarterFeature3'), t('planStarterFeature4')],
    },
    {
      key: 'PRO' as const,
      name: 'Pro',
      price: '150 000',
      listings: t('planProListings'),
      features: [t('planProFeature1'), t('planProFeature2'), t('planProFeature3'), t('planProFeature4'), t('planProFeature5')],
      highlighted: true,
    },
  ];

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSubscription = useCallback(async () => {
    try {
      const token = await getToken();
      const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (me.ok) {
        const meData = await me.json() as { roles: string[] };
        if (!meData.roles?.includes('PRO_AGENCE')) {
          router.replace('/bailleur');
          return;
        }
      }
      const res = await fetch(`${API}/subscriptions/me`, {
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
  }, [getToken, API, router]);

  useEffect(() => { void fetchSubscription(); }, [fetchSubscription]);

  useEffect(() => {
    const status = searchParams.get('status');

    if (status === 'success') {
      showToast('success', t('abonnementPaymentSuccess'));
      setPolling(true);
      let attempts = 0;
      pollRef.current = setInterval(() => {
        attempts += 1;
        void (async () => {
          try {
            const token = await getToken();
            const res   = await fetch(`${API}/subscriptions/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const sub = await res.json() as Subscription;
              if (sub.status === 'ACTIVE') {
                if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                setPolling(false);
                await fetchSubscription();
                return;
              }
            }
          } catch { /* retry on next tick */ }
          if (attempts >= 6 && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setPolling(false);
          }
        })();
      }, 2000);
    }

    if (status === 'cancel') showToast('error', t('abonnementPaymentCancelled'));

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const initiate = async (plan: 'STARTER' | 'PRO') => {
    // Réservé de façon SYNCHRONE avant tout `await`, sinon le navigateur
    // bloque le popup. On garde cette page ouverte (au lieu de la faire
    // naviguer vers PayDunya) pour ne pas rester "coincé" si PayDunya ne
    // redirige pas automatiquement au retour (observé en sandbox).
    const paymentTab = openPaymentTab();
    setInitiating(plan);
    try {
      const token = await getToken();
      const res   = await fetch(`${API}/subscriptions/initiate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan }),
      });
      if (!res.ok) {
        closePaymentTab(paymentTab);
        const err = await res.json() as { message?: string };
        showToast('error', err.message ?? t('abonnementInitError'));
        return;
      }
      const body = await res.json() as { payment_url?: string };
      if (!body.payment_url) {
        closePaymentTab(paymentTab);
        showToast('error', t('abonnementPaymentError'));
        return;
      }
      // PayDunya gère entièrement le choix du mode de paiement sur sa
      // propre page hébergée ; on ne fait que rediriger.
      redirectPaymentTab(paymentTab, body.payment_url);
    } catch {
      closePaymentTab(paymentTab);
      showToast('error', t('abonnementPaymentError2'));
    } finally {
      setInitiating(null);
    }
  };

  const statusLabel: Record<string, string> = {
    ACTIVE:    t('abonnementStatusActive'),
    SUSPENDED: t('abonnementStatusSuspended'),
    CANCELLED: t('abonnementStatusCancelled'),
  };
  const statusColor: Record<string, string> = {
    ACTIVE:    'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/40',
    SUSPENDED: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40',
    CANCELLED: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-900/40',
  };

  return (
    <div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg border ${
          toast.type === 'success' ? 'bg-green-50 dark:bg-green-950/30 text-green-800 border-green-200 dark:border-green-900/40' : 'bg-red-50 dark:bg-red-950/30 text-red-800 border-red-200 dark:border-red-900/40'
        }`}>
          {toast.msg}
        </div>
      )}

      {polling && (
        <div className={`fixed z-50 right-4 rounded-xl px-5 py-2 text-xs font-medium text-sub bg-card border border-line shadow ${toast ? 'top-20' : 'top-4'}`}>
          <i className="fa-solid fa-spinner fa-spin mr-1.5" />{t('abonnementChecking')}
        </div>
      )}

      {searchParams.get('reason') === 'required' && (
        <div className="mb-6 rounded-2xl border border-gold-dark/30 bg-gold-pale/40 p-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-pale">
            <i className="fa-solid fa-lock text-gold-dark" />
          </div>
          <div>
            <p className="font-semibold text-text">{t('abonnementRequired')}</p>
            <p className="text-sm text-sub mt-0.5">{t('abonnementRequiredHint')}</p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-text mb-1">{t('abonnementTitle')}</h1>
      <p className="text-sub text-sm mb-8">{t('abonnementSubtitle')}</p>

      {/* Current subscription */}
      {!loading && subscription && subscription.status !== 'CANCELLED' && (
        <div className="mb-8 rounded-2xl border border-line bg-card p-5">
          <p className="text-xs text-sub font-medium uppercase tracking-wide mb-1">{t('abonnementCurrent')}</p>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-text">{subscription.plan}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColor[subscription.status] ?? ''}`}>
              {statusLabel[subscription.status] ?? subscription.status}
            </span>
          </div>
          <p className="text-sm text-sub mt-1">
            {Number(subscription.monthlyFee).toLocaleString(numLocale)} {t('fcfaPerMonth')}
            {subscription.endDate && (
              subscription.status === 'SUSPENDED'
                ? ` — ${t('abonnementExpiredOn', { date: new Date(subscription.endDate).toLocaleDateString(numLocale) })}`
                : ` — ${t('abonnementExpiresOn', { date: new Date(subscription.endDate).toLocaleDateString(numLocale) })}`
            )}
          </p>
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
            const isActive      = subscription?.plan === plan.key && subscription.status === 'ACTIVE';
            const isCurrent     = subscription?.plan === plan.key && subscription.status !== 'CANCELLED';
            const isOtherActive = subscription?.status === 'ACTIVE' && subscription.plan !== plan.key;

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-6 transition ${
                  plan.highlighted ? 'border-gold bg-gold-pale/30 shadow-md' : 'border-line bg-card'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 text-xs font-bold text-gray-900">
                    {t('abonnementPopular')}
                  </span>
                )}
                <h2 className="text-lg font-bold text-text">{plan.name}</h2>
                <p className="mt-1 text-3xl font-extrabold text-text">
                  {plan.price} <span className="text-base font-medium text-sub">{t('fcfaPerMonth')}</span>
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

                {isOtherActive ? (
                  <div className="mt-6">
                    <button
                      disabled
                      className="w-full rounded-xl py-2.5 text-sm font-semibold border border-line bg-gray-50 dark:bg-gray-950/30 text-gray-400 cursor-not-allowed"
                    >
                      {t('abonnementChangePlan')}
                    </button>
                    <p className="mt-2 text-xs text-sub text-center">{t('abonnementChangePlanNote')}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => !isActive && setConfirmPlan(plan)}
                    disabled={isActive || initiating !== null}
                    className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 cursor-default'
                        : plan.highlighted
                          ? 'btn-gold'
                          : 'border border-line bg-card text-text hover:bg-gold-pale hover:text-gold-dark'
                    }`}
                  >
                    {isActive ? (
                      <><i className="fa-solid fa-check mr-1" />{t('abonnementPlanActive')}</>
                    ) : isCurrent ? (
                      t('abonnementRenew')
                    ) : (
                      t('abonnementChoose')
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-sub text-center">{t('abonnementSecureNote')}</p>

      {/* Confirmation modal */}
      {confirmPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line p-6 shadow-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-receipt text-gold-dark" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-1">{t('abonnementConfirmTitle')}</h2>
            <p className="text-sm text-sub mb-5">{t('abonnementConfirmSubtitle')}</p>

            <div className="rounded-xl border border-line bg-surface p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-text">{confirmPlan.name}</span>
                <span className="text-sm font-bold text-text">{confirmPlan.price} {t('fcfaPerMonth')}</span>
              </div>
              <p className="text-xs text-sub mb-3">{confirmPlan.listings}</p>
              <ul className="space-y-1.5">
                {confirmPlan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-sub">
                    <i className="fa-solid fa-check text-gold-dark text-xs shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-sub text-center mb-5">
              <i className="fa-solid fa-shield-halved mr-1 text-gold-dark" />
              {t('abonnementSecureNote')}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPlan(null)}
                disabled={initiating !== null}
                className="flex-1 text-sm font-medium text-sub hover:text-text px-4 py-2.5 rounded-xl border border-line transition-colors disabled:opacity-50"
              >
                {t('abonnementConfirmBack')}
              </button>
              <button
                onClick={() => { setConfirmPlan(null); void initiate(confirmPlan.key); }}
                disabled={initiating !== null}
                className="flex-1 btn-gold text-sm disabled:opacity-50"
              >
                {initiating === confirmPlan.key ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2" />{t('abonnementConfirmRedirecting')}</>
                ) : (
                  <><i className="fa-solid fa-arrow-right mr-2" />{t('abonnementConfirmPay')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AbonnementPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    }>
      <AbonnementContent />
    </Suspense>
  );
}
