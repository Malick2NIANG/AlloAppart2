'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

type Method = 'menu' | 'orange-money' | 'wave' | 'free-money' | 'card';

interface SoftpayResponse {
  success: boolean;
  message: string;
  url?: string;
  omUrl?: string;
  maxitUrl?: string;
}

interface PaydunyaPaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** Montant affiché (FCFA). */
  amount: number | string;
  /** Token d'invoice PayDunya déjà créée par le flux appelant (réservation/boost/abonnement). */
  paymentToken: string | null;
  /** URL de la page hébergée PayDunya (pour le paiement par carte, en redirection). */
  cardUrl: string | null;
  /** Vérification active du statut — spécifique au flux appelant, appelée en polling. Retourne true si confirmé. */
  onVerify: () => Promise<boolean>;
  /** Appelé une fois le paiement confirmé. */
  onSuccess: () => void;
}

const POLL_INTERVAL_MS = 4000;

function sanitizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('221') ? digits.slice(3) : digits;
}

function isValidSenegalPhone(raw: string): boolean {
  const digits = sanitizePhone(raw);
  return /^[7][0-9]{8}$/.test(digits);
}

export default function PaydunyaPaymentModal({
  open,
  onClose,
  amount,
  paymentToken,
  cardUrl,
  onVerify,
  onSuccess,
}: PaydunyaPaymentModalProps) {
  const t = useTranslations('paydunyaModal');
  const { getToken } = useAuth();

  const [method, setMethod]     = useState<Method>('menu');
  const [phone, setPhone]       = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [softpayResult, setSoftpayResult] = useState<SoftpayResponse | null>(null);
  const [polling, setPolling]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset de l'état interne à chaque ouverture — ajustement pendant le rendu
  // (pattern recommandé React pour "reset state when a prop changes"),
  // plutôt qu'un effect, pour éviter un rendu intermédiaire inutile.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMethod('menu');
      setPhone('');
      setPhoneError(null);
      setLoading(false);
      setError(null);
      setSoftpayResult(null);
      setPolling(false);
      setConfirmed(false);
    }
  }

  // Polling du statut pendant qu'on attend confirmation
  useEffect(() => {
    if (!polling) return;
    pollRef.current = setInterval(() => {
      void onVerify().then((ok) => {
        if (ok) {
          setPolling(false);
          setConfirmed(true);
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => { onSuccess(); onClose(); }, 1400);
        }
      });
    }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling]);

  if (!open) return null;

  const startCard = () => {
    if (!cardUrl) return;
    window.open(cardUrl, '_blank', 'noopener,noreferrer');
    setMethod('card');
    setPolling(true);
  };

  const submitPhoneMethod = async (target: 'orange-money' | 'wave' | 'free-money') => {
    if (!paymentToken) return;
    if (!isValidSenegalPhone(phone)) {
      setPhoneError(t('phoneInvalid'));
      return;
    }
    setPhoneError(null);
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await api.post<SoftpayResponse>(
        `/payments/softpay/${target}`,
        { paymentToken, phone: sanitizePhone(phone) },
        token ?? undefined,
      );
      setSoftpayResult(res);
      if (res.success) {
        if (target === 'wave' && res.url) {
          window.open(res.url, '_blank', 'noopener,noreferrer');
        }
        if (target === 'orange-money' && res.url) {
          window.open(res.url, '_blank', 'noopener,noreferrer');
        }
        setPolling(true);
      } else {
        setError(res.message || t('errorGeneric'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const methods: { key: Method; label: string; logo?: string; icon?: string; color: string }[] = [
    { key: 'orange-money', label: t('methodOrangeMoney'), logo: '/payment-logos/orange-money.svg', color: 'border-orange-300 bg-orange-50 text-orange-700' },
    { key: 'wave',         label: t('methodWave'),         logo: '/payment-logos/wave.png',         color: 'border-blue-300 bg-blue-50 text-blue-700' },
    { key: 'free-money',   label: t('methodFreeMoney'),    logo: '/payment-logos/mixx-by-yas.svg',  color: 'border-[#003881]/20 bg-[#003881]/5 text-[#003881]' },
    { key: 'card',         label: t('methodCard'),         icon: 'fa-credit-card',  color: 'border-line bg-bg text-text' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">
        <div className="bg-linear-to-r from-gold to-gold-light px-6 py-5 text-center">
          <h2 className="text-xl font-extrabold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-800/80 mt-1">
            {t('amountLabel')} : <span className="font-bold">{formatPrice(amount)}</span>
          </p>
        </div>

        <div className="p-6">
          {confirmed ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-4 ring-green-100">
                <i className="fa-solid fa-circle-check text-3xl text-green-600" />
              </div>
              <p className="font-semibold text-text">{t('successMessage')}</p>
            </div>
          ) : method === 'menu' ? (
            <div className="flex flex-col gap-2.5">
              {methods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => (m.key === 'card' ? startCard() : setMethod(m.key))}
                  disabled={!paymentToken && m.key !== 'card'}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:brightness-95 disabled:opacity-50 ${m.color}`}
                >
                  {m.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- petit logo statique, taille fixe connue
                    <img src={m.logo} alt="" className="h-6 w-10 shrink-0 object-contain" />
                  ) : (
                    <i className={`fa-solid ${m.icon} w-5 text-center`} />
                  )}
                  {m.label}
                </button>
              ))}
            </div>
          ) : polling ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
              <p className="font-semibold text-text">{t('waitingConfirmation')}</p>
              <p className="text-xs text-sub">{t('waitingHint')}</p>

              {method === 'orange-money' && softpayResult?.omUrl && (
                <div className="mt-2 flex flex-col gap-2 w-full">
                  <a href={softpayResult.omUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-xl border border-orange-300 bg-orange-50 text-orange-700 px-4 py-2 text-sm font-semibold text-center">
                    {t('omOpenApp')}
                  </a>
                  {softpayResult.maxitUrl && (
                    <a href={softpayResult.maxitUrl} target="_blank" rel="noopener noreferrer"
                      className="rounded-xl border border-line bg-bg px-4 py-2 text-sm font-semibold text-center text-text">
                      {t('omOpenMaxit')}
                    </a>
                  )}
                </div>
              )}
              {method === 'free-money' && (
                <p className="text-sm text-text font-medium">{t('freeMoneyInstructions')}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-sub">
                {method === 'orange-money' && t('omInstructions')}
                {method === 'wave'         && t('waveInstructions')}
                {method === 'free-money'   && t('freeMoneyInstructions')}
              </p>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sub">
                  {t('phoneLabel')}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }}
                  placeholder={t('phonePlaceholder')}
                  className="input-field"
                />
                {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setMethod('menu')}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-line py-3 text-sm font-medium text-sub hover:text-text hover:border-text/30 transition-colors disabled:opacity-50"
                >
                  {t('backBtn')}
                </button>
                <button
                  onClick={() => void submitPhoneMethod(method as 'orange-money' | 'wave' | 'free-money')}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3 text-sm transition-colors disabled:opacity-50"
                >
                  {loading
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-lock text-xs" />{t('payBtn')}</>}
                </button>
              </div>
            </div>
          )}

          {!confirmed && method === 'menu' && (
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-xl border border-line py-2.5 text-sm font-medium text-sub hover:text-text transition-colors"
            >
              {t('cancelBtn')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
