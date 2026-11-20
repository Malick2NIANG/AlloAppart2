'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  detectIsIOS,
  detectIsStandalone,
  isPushSupported,
  resolvePushUiState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushUiState,
} from '@/lib/push';

interface Preferences {
  messages: boolean;
  bookings: boolean;
  payments: boolean;
  listings: boolean;
}

const DEFAULT_PREFS: Preferences = {
  messages: true,
  bookings: true,
  payments: true,
  listings: true,
};

const CATEGORIES: Array<{ key: keyof Preferences; labelKey: string; icon: string }> = [
  { key: 'messages', labelKey: 'categoryMessages', icon: 'fa-comment-dots' },
  { key: 'bookings', labelKey: 'categoryBookings', icon: 'fa-calendar-check' },
  { key: 'payments', labelKey: 'categoryPayments', icon: 'fa-sack-dollar' },
  { key: 'listings', labelKey: 'categoryListings', icon: 'fa-shield-halved' },
];

/**
 * Lot « notifications push » — section Réglages/Notifications. Toute
 * détection de support/permission est CLIENT-ONLY (useEffect, jamais au
 * rendu serveur) : `checked` reste faux le temps de la première passe,
 * affiche un skeleton plutôt qu'un état potentiellement faux.
 */
export default function NotificationsSettings() {
  const { isSignedIn, getToken } = useAuth();
  const locale = useLocale();
  const t = useTranslations('pushSettings');

  const [checked, setChecked] = useState(false);
  const [uiState, setUiState] = useState<PushUiState>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

  const refreshEnvironment = useCallback(async () => {
    const supported = isPushSupported(navigator, window);
    const permission =
      typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    const isIOS = detectIsIOS(navigator.userAgent);
    const isStandalone = detectIsStandalone(
      navigator as { standalone?: boolean },
      window.matchMedia ? window.matchMedia.bind(window) : undefined,
    );
    const state = resolvePushUiState({ supported, permission, isIOS, isStandalone });
    setUiState(state);

    let activeSubscription = false;
    if (state === 'enabled' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker
        .getRegistration()
        .catch(() => undefined);
      const subscription = await registration?.pushManager
        .getSubscription()
        .catch(() => null);
      activeSubscription = !!subscription;
    }
    setSubscribed(activeSubscription);
    setChecked(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- détection client-only (APIs navigateur absentes côté serveur), jamais rejouée en boucle
  useEffect(() => { void refreshEnvironment(); }, [refreshEnvironment]);

  useEffect(() => {
    if (!isSignedIn || uiState !== 'enabled' || !subscribed) return;
    void (async () => {
      const token = await getToken().catch(() => null);
      if (!token) return;
      const data = await api
        .get<Preferences & { id: string | null }>('/push/preferences', token)
        .catch(() => null);
      if (data) {
        setPrefs({
          messages: data.messages,
          bookings: data.bookings,
          payments: data.payments,
          listings: data.listings,
        });
      }
    })();
  }, [isSignedIn, uiState, subscribed, getToken]);

  const handleActivate = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      await subscribeToPush(token, locale);
      await refreshEnvironment();
    } catch {
      setError(t('activateError'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisableDevice = async () => {
    setBusy(true);
    try {
      const token = await getToken().catch(() => undefined);
      await unsubscribeFromPush(token ?? undefined);
      await refreshEnvironment();
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = async (key: keyof Preferences) => {
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const token = await getToken().catch(() => null);
    if (!token) {
      setPrefs(previous);
      return;
    }
    await api
      .patch('/push/preferences', { [key]: next[key] }, token)
      .catch(() => setPrefs(previous));
  };

  if (!isSignedIn) {
    return (
      <main className="py-16 px-4 bg-bg min-h-screen">
        <div className="aa-container max-w-2xl text-center">
          <p className="text-sub text-sm">{t('signInRequired')}</p>
          <Link
            href="/sign-in"
            className="btn-gold mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            {t('signIn')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="py-10 px-4 bg-bg min-h-screen max-md:min-h-dvh max-md:py-6">
      <div className="aa-container max-w-2xl space-y-6">
        <nav className="flex items-center gap-1.5 text-xs text-sub">
          <Link href="/profil" className="hover:text-gold-dark transition-colors">
            {t('profile')}
          </Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('breadcrumbLink')}</span>
        </nav>

        <h1 className="text-xl font-extrabold text-text flex items-center gap-2">
          <i className="fa-solid fa-bell text-gold-dark" /> {t('title')}
        </h1>

        {!checked && <SettingsSkeleton />}

        {checked && uiState === 'unsupported' && (
          <InfoCard icon="fa-bell-slash" title={t('unsupportedTitle')} desc={t('unsupportedDesc')} />
        )}

        {checked && uiState === 'ios-not-installed' && (
          <section className="rounded-2xl border border-line bg-card p-6 space-y-3 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <i className="fa-solid fa-mobile-screen text-gold-dark text-xs" /> {t('iosTitle')}
            </h2>
            <p className="text-sm text-sub">{t('iosDesc')}</p>
            <ol className="text-sm text-sub space-y-1 list-none">
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-arrow-up-from-bracket text-gold-dark text-xs w-4" /> {t('iosStep1')}
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-square-plus text-gold-dark text-xs w-4" /> {t('iosStep2')}
              </li>
            </ol>
          </section>
        )}

        {checked && uiState === 'denied' && (
          <InfoCard icon="fa-bell-slash" title={t('deniedTitle')} desc={t('deniedDesc')} />
        )}

        {checked && (uiState === 'default' || (uiState === 'enabled' && !subscribed)) && (
          <section className="rounded-2xl border border-line bg-card p-6 space-y-4 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <i className="fa-solid fa-bell text-gold-dark text-xs" /> {t('activateTitle')}
            </h2>
            <p className="text-sm text-sub">{t('activateDesc')}</p>
            {error && (
              <p className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                <i className="fa-solid fa-circle-exclamation shrink-0" /> {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleActivate()}
              disabled={busy}
              className="btn-gold rounded-full px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50 max-md:w-full max-md:h-12"
            >
              {busy ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> {t('activating')}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-bell" /> {t('activateButton')}
                </>
              )}
            </button>
          </section>
        )}

        {checked && uiState === 'enabled' && subscribed && (
          <>
            <section className="rounded-2xl border border-line bg-card p-6 space-y-1 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
              <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-xs" /> {t('enabledTitle')}
              </h2>
            </section>

            <section className="rounded-2xl border border-line bg-card p-6 space-y-1 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
              <h2 className="mb-2 text-sm font-semibold text-text flex items-center gap-2">
                <i className="fa-solid fa-sliders text-gold-dark text-xs" /> {t('categoriesTitle')}
              </h2>
              {CATEGORIES.map(({ key, labelKey, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void toggleCategory(key)}
                  role="switch"
                  aria-checked={prefs[key]}
                  className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-line py-3 text-sm font-medium text-text first:border-t-0"
                >
                  <span className="flex items-center gap-2">
                    <i className={`fa-solid ${icon} text-gold-dark text-xs w-4`} />
                    {t(labelKey as Parameters<typeof t>[0])}
                  </span>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[key] ? 'bg-gold-dark' : 'bg-line'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs[key] ? 'left-[22px]' : 'left-0.5'}`}
                    />
                  </span>
                </button>
              ))}
            </section>

            <section className="rounded-2xl border border-line bg-card p-6 space-y-3 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
              <h2 className="text-sm font-semibold text-text flex items-center gap-2">
                <i className="fa-solid fa-ban text-gold-dark text-xs" /> {t('disableDeviceTitle')}
              </h2>
              <p className="text-sm text-sub">{t('disableDeviceDesc')}</p>
              <button
                type="button"
                onClick={() => void handleDisableDevice()}
                disabled={busy}
                className="rounded-full border border-line px-5 py-2 text-sm font-medium text-sub hover:border-red-300 hover:text-red-600 transition disabled:opacity-50 max-md:w-full max-md:h-12 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" /> {t('disabling')}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-ban" /> {t('disableDeviceButton')}
                  </>
                )}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function InfoCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-6 space-y-2 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
      <h2 className="text-sm font-semibold text-text flex items-center gap-2">
        <i className={`fa-solid ${icon} text-gold-dark text-xs`} /> {title}
      </h2>
      <p className="text-sm text-sub">{desc}</p>
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" role="status">
      <div className="h-24 animate-pulse rounded-2xl bg-card" />
      <div className="h-24 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}
