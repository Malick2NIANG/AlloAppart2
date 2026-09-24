'use client';

/**
 * Configuration admin — anciennement en lecture seule (valeurs codées en
 * dur, modifiables uniquement via .env + redéploiement). Demande explicite
 * du client : rendre ces tarifs éditables depuis cette page, avec une
 * confirmation obligatoire par code PIN (par défaut 2002, modifiable) ou par
 * un code à usage unique envoyé par email — pour éviter qu'une modification
 * accidentelle change des tarifs facturés sur toute la plateforme.
 * Backend : PlatformConfigModule (/admin/config, /admin/config/otp,
 * /admin/config/pin).
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

type PricingFieldKey =
  | 'starterPriceFcfa'
  | 'proPriceFcfaMonthly'
  | 'nightlyCommissionRate'
  | 'monthlyCommissionMonths'
  | 'auditBasicPriceFcfa'
  | 'boostPriceFcfa';

interface PendingPlatformConfig {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionRate: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
  boostPriceFcfa: number;
  effectiveAt: string;
  setByEmail: string | null;
}

interface PlatformConfig {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionRate: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
  boostPriceFcfa: number;
  updatedAt: string;
  updatedByEmail: string | null;
  /** Changement tarifaire programmé (préavis CGU Article 7), ou null. */
  pending: PendingPlatformConfig | null;
}

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

/** Note « → nouvelle valeur le {date} » affichée sous un champ si un
 * changement est programmé et diffère de la valeur courante. */
function pendingFieldNote(
  config: PlatformConfig | null,
  field: PricingFieldKey,
  format: (v: number) => string,
  t: Translator,
): string | undefined {
  if (!config?.pending) return undefined;
  const pendingValue = config.pending[field];
  const liveValue = config[field];
  if (pendingValue === liveValue) return undefined;
  return t('configPendingFieldNote', {
    value: format(pendingValue),
    date: formatDate(config.pending.effectiveAt),
  });
}

interface ConfigForm {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionPercent: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
  boostPriceFcfa: number;
}

type ConfirmMethod = 'PIN' | 'OTP';

function toForm(cfg: PlatformConfig): ConfigForm {
  return {
    starterPriceFcfa: cfg.starterPriceFcfa,
    proPriceFcfaMonthly: cfg.proPriceFcfaMonthly,
    nightlyCommissionPercent: Math.round(cfg.nightlyCommissionRate * 1000) / 10,
    monthlyCommissionMonths: cfg.monthlyCommissionMonths,
    auditBasicPriceFcfa: cfg.auditBasicPriceFcfa,
    boostPriceFcfa: cfg.boostPriceFcfa,
  };
}

export default function AdminConfigPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('admin');

  const [config, setConfig]   = useState<PlatformConfig | null>(null);
  const [form, setForm]       = useState<ConfigForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [reindexing, setReindexing]       = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);
  const [reindexError, setReindexError]   = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen]             = useState(false);
  const [pinModalOpen, setPinModalOpen]           = useState(false);
  const [cancelPendingOpen, setCancelPendingOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const cfg = await api.get<PlatformConfig>('/admin/config', token);
      setConfig(cfg);
      setForm(toForm(cfg));
    } catch {
      setError(t('configLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial, setState après résolution async
  useEffect(() => { void load(); }, [load]);

  const handleReindex = async () => {
    const token = await getToken();
    if (!token) return;
    setReindexing(true);
    setReindexResult(null);
    setReindexError(null);
    try {
      const res = await api.post<{ indexed: number }>('/search/reindex', {}, token);
      setReindexResult(t('configReindexResult', { count: res.indexed }));
    } catch (err) {
      setReindexError(err instanceof Error ? err.message : t('configReindexError'));
    } finally {
      setReindexing(false);
    }
  };

  const dirty = !!(config && form && (
    form.starterPriceFcfa !== config.starterPriceFcfa ||
    form.proPriceFcfaMonthly !== config.proPriceFcfaMonthly ||
    Math.abs(form.nightlyCommissionPercent / 100 - config.nightlyCommissionRate) > 1e-6 ||
    form.monthlyCommissionMonths !== config.monthlyCommissionMonths ||
    form.auditBasicPriceFcfa !== config.auditBasicPriceFcfa ||
    form.boostPriceFcfa !== config.boostPriceFcfa
  ));

  const setField = (key: keyof ConfigForm, value: number) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const requestOtp = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error(t('configConfirmErrorFallback'));
    await api.post('/admin/config/otp', {}, token);
  }, [getToken, t]);

  const handleSaveConfirmed = async (
    method: ConfirmMethod,
    code: string,
    effectiveInDays: number,
  ) => {
    if (!form) return;
    const token = await getToken();
    if (!token) throw new Error(t('configConfirmErrorFallback'));
    const updated = await api.patch<PlatformConfig>('/admin/config', {
      starterPriceFcfa: form.starterPriceFcfa,
      proPriceFcfaMonthly: form.proPriceFcfaMonthly,
      nightlyCommissionRate: form.nightlyCommissionPercent / 100,
      monthlyCommissionMonths: form.monthlyCommissionMonths,
      auditBasicPriceFcfa: form.auditBasicPriceFcfa,
      boostPriceFcfa: form.boostPriceFcfa,
      confirmMethod: method,
      confirmCode: code,
      effectiveInDays,
    }, token);
    setConfig(updated);
    setForm(toForm(updated));
    setConfirmOpen(false);
    toast.success(effectiveInDays > 0 ? t('configScheduledToast') : t('configSavedToast'));
  };

  const handleCancelPendingConfirmed = async (method: ConfirmMethod, code: string) => {
    const token = await getToken();
    if (!token) throw new Error(t('configConfirmErrorFallback'));
    const updated = await api.post<PlatformConfig>('/admin/config/pending/cancel', {
      confirmMethod: method,
      confirmCode: code,
    }, token);
    setConfig(updated);
    setForm(toForm(updated));
    setCancelPendingOpen(false);
    toast.success(t('configPendingCancelledToast'));
  };

  const handlePinChangeConfirmed = async (
    method: ConfirmMethod,
    code: string,
    newPin: string,
  ) => {
    const token = await getToken();
    if (!token) throw new Error(t('configConfirmErrorFallback'));
    await api.patch('/admin/config/pin', {
      confirmMethod: method,
      confirmCode: code,
      newPin,
    }, token);
    setPinModalOpen(false);
    toast.success(t('configPinChangedToast'));
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('configTitle')}</h1>
          <p className="mt-1 text-sm text-sub">{t('configSubtitle')}</p>
          {config && (
            <p className="mt-1 text-xs text-sub">
              {t('configLastUpdated', {
                date: formatDate(config.updatedAt),
                email: config.updatedByEmail ?? '—',
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
              <i className="fa-solid fa-circle-exclamation mr-1" />{t('configUnsavedBadge')}
            </span>
          )}
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="text-xs font-medium border border-line bg-card px-3 py-2 rounded-lg text-sub hover:text-text transition-colors whitespace-nowrap"
          >
            <i className="fa-solid fa-key mr-1.5" />{t('configChangePinButton')}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!dirty}
            className="btn-gold text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-floppy-disk mr-1.5" />{t('configSaveChanges')}
          </button>
        </div>
      </div>

      {config?.pending && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <i className="fa-solid fa-clock mr-2" />
            {t('configPendingBanner', { date: formatDate(config.pending.effectiveAt) })}
          </div>
          <button
            type="button"
            onClick={() => setCancelPendingOpen(true)}
            className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {t('configCancelPending')}
          </button>
        </div>
      )}

      {loading || !form ? (
        <ConfigSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => void load()} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Plans d'abonnement */}
          <Section title={t('configPlansTitle')} icon="fa-id-card">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditableField
                label={t('configPlanStarter')} sub={t('configPlanStarterSub')}
                value={form.starterPriceFcfa} onChange={(v) => setField('starterPriceFcfa', v)}
                suffix={`${t('configFcfa')} ${t('configPerMonth')}`}
                pendingNote={pendingFieldNote(config, 'starterPriceFcfa', (v) => `${v.toLocaleString('fr-SN')} ${t('configFcfa')}`, t)}
              />
              <EditableField
                label={t('configPlanPro')} sub={t('configPlanProSub')}
                value={form.proPriceFcfaMonthly} onChange={(v) => setField('proPriceFcfaMonthly', v)}
                suffix={`${t('configFcfa')} ${t('configPerMonth')}`}
                pendingNote={pendingFieldNote(config, 'proPriceFcfaMonthly', (v) => `${v.toLocaleString('fr-SN')} ${t('configFcfa')}`, t)}
              />
            </div>
          </Section>

          {/* Commissions */}
          <Section title={t('configCommissionTitle')} icon="fa-percent">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditableField
                label={t('configCommissionNightlyLabel')} sub={t('configCommissionNightlySub')}
                value={form.nightlyCommissionPercent}
                onChange={(v) => setField('nightlyCommissionPercent', v)}
                suffix="%" step={0.5} min={0} max={100}
                pendingNote={pendingFieldNote(config, 'nightlyCommissionRate', (v) => `${Math.round(v * 1000) / 10}%`, t)}
              />
              <EditableField
                label={t('configCommissionMonthlyLabel')} sub={t('configCommissionMonthlySub')}
                value={form.monthlyCommissionMonths}
                onChange={(v) => setField('monthlyCommissionMonths', v)}
                suffix={t('configMonthsUnit')} step={0.5} min={0}
                pendingNote={pendingFieldNote(config, 'monthlyCommissionMonths', (v) => `${v} ${t('configMonthsUnit')}`, t)}
              />
            </div>
          </Section>

          {/* AlloVérifié */}
          <Section title={t('configVerifTitle')} icon="fa-shield-halved">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditableField
                label={t('configAuditBasic')} sub={t('configAuditBasicSub')}
                value={form.auditBasicPriceFcfa} onChange={(v) => setField('auditBasicPriceFcfa', v)}
                suffix={t('configFcfa')}
                pendingNote={pendingFieldNote(config, 'auditBasicPriceFcfa', (v) => `${v.toLocaleString('fr-SN')} ${t('configFcfa')}`, t)}
              />
            </div>
          </Section>

          {/* Boost annonces */}
          <Section title={t('configBoostTitle')} icon="fa-rocket">
            <EditableField
              label={t('configBoostLabel')} sub={t('configBoostSub')}
              value={form.boostPriceFcfa} onChange={(v) => setField('boostPriceFcfa', v)}
              suffix={t('configFcfa')}
              pendingNote={pendingFieldNote(config, 'boostPriceFcfa', (v) => `${v.toLocaleString('fr-SN')} ${t('configFcfa')}`, t)}
            />
          </Section>

          {/* Meilisearch (inchangé) */}
          <Section title={t('configSearchTitle')} icon="fa-magnifying-glass">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-xl border border-line bg-bg px-4 py-3">
                <p className="text-xs text-sub mb-0.5">{t('configStatus')}</p>
                <p className="text-sm font-medium text-text">
                  <i className="fa-solid fa-circle text-emerald-500 text-xs mr-1.5" />{t('configOperational')}
                </p>
              </div>
              <div className="flex-1 rounded-xl border border-line bg-bg px-4 py-3">
                <p className="text-xs text-sub mb-0.5">{t('configMainIndex')}</p>
                <p className="text-sm font-mono text-text">listings</p>
              </div>
              <div className="shrink-0">
                <p className="text-xs text-sub mb-1.5">{t('configManualReindex')}</p>
                <button
                  onClick={handleReindex}
                  disabled={reindexing}
                  className="text-xs font-medium border border-line bg-card px-4 py-2 rounded-lg text-text hover:bg-bg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {reindexing
                    ? <><i className="fa-solid fa-spinner fa-spin mr-1.5 text-xs" />{t('configReindexing')}</>
                    : <><i className="fa-solid fa-rotate mr-1.5 text-xs" />{t('configReindex')}</>}
                </button>
                {reindexResult && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <i className="fa-solid fa-circle-check mr-1" />{reindexResult}
                  </p>
                )}
                {reindexError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{reindexError}</p>
                )}
              </div>
            </div>
          </Section>

          {/* Note de bas de page */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
            <i className="fa-solid fa-circle-info mr-2" />
            {t('configFooterNote')}
          </div>
        </div>
      )}

      {confirmOpen && (
        <ConfirmModal
          title={t('configConfirmTitle')}
          subtitle={t('configConfirmSubtitle')}
          onClose={() => setConfirmOpen(false)}
          onRequestOtp={requestOtp}
          onSubmit={handleSaveConfirmed}
          t={t}
        />
      )}

      {pinModalOpen && (
        <ChangePinModal
          onClose={() => setPinModalOpen(false)}
          onRequestOtp={requestOtp}
          onSubmit={handlePinChangeConfirmed}
          t={t}
        />
      )}

      {cancelPendingOpen && config?.pending && (
        <CancelPendingModal
          effectiveAt={config.pending.effectiveAt}
          onClose={() => setCancelPendingOpen(false)}
          onRequestOtp={requestOtp}
          onSubmit={handleCancelPendingConfirmed}
          t={t}
        />
      )}
    </div>
  );
}

// ── Sous-composants ──────────────────────────────────────────────────────

function Section({
  title, icon, children,
}: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <i className={`fa-solid ${icon} text-sub text-sm`} />
        <h2 className="font-semibold text-text">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EditableField({
  label, sub, value, onChange, suffix, min = 0, max, step = 1, pendingNote,
}: {
  label: string; sub: string; value: number; onChange: (v: number) => void;
  suffix?: string; min?: number; max?: number; step?: number; pendingNote?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg px-4 py-3">
      <p className="text-xs text-sub mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input-field !w-auto !flex-1 !py-1.5 text-base font-bold"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-xs text-sub shrink-0 whitespace-nowrap">{suffix}</span>}
      </div>
      <p className="text-xs text-sub mt-1.5">{sub}</p>
      {pendingNote && (
        <p className="mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
          <i className="fa-solid fa-clock mr-1" />{pendingNote}
        </p>
      )}
    </div>
  );
}

function ConfigSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-32 rounded-2xl border border-line bg-card animate-pulse" />
      ))}
    </div>
  );
}

/** Sélecteur PIN/OTP + champ de code, partagé entre ConfirmModal et ChangePinModal. */
function ConfirmMethodPicker({
  method, setMethod, code, setCode, onRequestOtp, t,
}: {
  method: ConfirmMethod;
  setMethod: (m: ConfirmMethod) => void;
  code: string;
  setCode: (c: string) => void;
  onRequestOtp: () => Promise<void>;
  t: Translator;
}) {
  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    setOtpRequesting(true);
    setOtpError(null);
    try {
      await onRequestOtp();
      setOtpSent(true);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t('configConfirmErrorFallback'));
    } finally {
      setOtpRequesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMethod('PIN')}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${method === 'PIN' ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}
        >
          <i className="fa-solid fa-key mr-1.5" />{t('configMethodPin')}
        </button>
        <button
          type="button"
          onClick={() => setMethod('OTP')}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${method === 'OTP' ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'}`}
        >
          <i className="fa-solid fa-envelope mr-1.5" />{t('configMethodOtp')}
        </button>
      </div>

      {method === 'PIN' ? (
        <div>
          <label className="text-xs text-sub">{t('configPinCodeLabel')}</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            className="input-field mt-1"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {!otpSent ? (
            <button
              type="button"
              onClick={() => void handleRequestOtp()}
              disabled={otpRequesting}
              className="w-full text-xs font-medium border border-line bg-card px-4 py-2 rounded-lg text-text hover:bg-bg disabled:opacity-60 transition-colors"
            >
              {otpRequesting
                ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />{t('configOtpRequesting')}</>
                : <><i className="fa-solid fa-paper-plane mr-1.5" />{t('configOtpRequestButton')}</>}
            </button>
          ) : (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <i className="fa-solid fa-circle-check mr-1" />{t('configOtpSentNote')}
            </p>
          )}
          {otpError && <p className="text-xs font-medium text-red-600 dark:text-red-400">{otpError}</p>}
          <div>
            <label className="text-xs text-sub">{t('configOtpCodeLabel')}</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              className="input-field mt-1"
              value={code}
              disabled={!otpSent}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({
  title, subtitle, onClose, onRequestOtp, onSubmit, t,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onRequestOtp: () => Promise<void>;
  onSubmit: (method: ConfirmMethod, code: string, effectiveInDays: number) => Promise<void>;
  t: Translator;
}) {
  const [method, setMethod] = useState<ConfirmMethod>('PIN');
  const [code, setCode]     = useState('');
  const [effectiveInDays, setEffectiveInDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSubmit(method, code, effectiveInDays);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('configConfirmErrorFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
          <i className="fa-solid fa-shield-halved text-gold-dark" />
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">{title}</h2>
        <p className="text-sm text-sub mb-4">{subtitle}</p>

        <div className="mb-4">
          <label className="text-xs text-sub">{t('configEffectiveInDaysLabel')}</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={365}
              className="input-field !w-24 !py-1.5"
              value={effectiveInDays}
              onChange={(e) => setEffectiveInDays(Math.max(0, Math.min(365, Number(e.target.value))))}
            />
            <span className="text-xs text-sub">{t('configEffectiveInDaysSuffix')}</span>
          </div>
          <p className="mt-1.5 text-xs text-sub">{t('configEffectiveInDaysHint')}</p>
          {effectiveInDays <= 0 && (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <i className="fa-solid fa-triangle-exclamation mr-1" />{t('configEffectiveImmediateWarning')}
            </p>
          )}
        </div>

        <ConfirmMethodPicker method={method} setMethod={setMethod} code={code} setCode={setCode} onRequestOtp={onRequestOtp} t={t} />

        {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} disabled={loading}
            className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors disabled:opacity-50">
            {t('cancel')}
          </button>
          <button onClick={() => void handleSubmit()} disabled={loading || code.length < 4}
            className="text-sm font-medium btn-gold px-4 py-2 disabled:opacity-50">
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : t('configConfirmSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modale d'annulation d'un changement tarifaire programmé (préavis en cours). */
function CancelPendingModal({
  effectiveAt, onClose, onRequestOtp, onSubmit, t,
}: {
  effectiveAt: string;
  onClose: () => void;
  onRequestOtp: () => Promise<void>;
  onSubmit: (method: ConfirmMethod, code: string) => Promise<void>;
  t: Translator;
}) {
  const [method, setMethod] = useState<ConfirmMethod>('PIN');
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSubmit(method, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('configConfirmErrorFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
          <i className="fa-solid fa-ban text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">{t('configCancelPendingTitle')}</h2>
        <p className="text-sm text-sub mb-4">
          {t('configCancelPendingSubtitle', { date: formatDate(effectiveAt) })}
        </p>

        <ConfirmMethodPicker method={method} setMethod={setMethod} code={code} setCode={setCode} onRequestOtp={onRequestOtp} t={t} />

        {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} disabled={loading}
            className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors disabled:opacity-50">
            {t('cancel')}
          </button>
          <button onClick={() => void handleSubmit()} disabled={loading || code.length < 4}
            className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : t('configCancelPendingSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePinModal({
  onClose, onRequestOtp, onSubmit, t,
}: {
  onClose: () => void;
  onRequestOtp: () => Promise<void>;
  onSubmit: (method: ConfirmMethod, code: string, newPin: string) => Promise<void>;
  t: Translator;
}) {
  const [method, setMethod] = useState<ConfirmMethod>('PIN');
  const [code, setCode]     = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async () => {
    if (newPin !== newPinConfirm) {
      setError(t('configNewPinMismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(method, code, newPin);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('configConfirmErrorFallback'));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = code.length >= 4 && newPin.length >= 4 && newPinConfirm.length >= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-line p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
          <i className="fa-solid fa-key text-gold-dark" />
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">{t('configChangePinTitle')}</h2>
        <p className="text-sm text-sub mb-4">{t('configChangePinSubtitle')}</p>

        <ConfirmMethodPicker method={method} setMethod={setMethod} code={code} setCode={setCode} onRequestOtp={onRequestOtp} t={t} />

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-sub">{t('configNewPinLabel')}</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              className="input-field mt-1"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="text-xs text-sub">{t('configNewPinConfirmLabel')}</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              className="input-field mt-1"
              value={newPinConfirm}
              onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} disabled={loading}
            className="text-sm font-medium text-sub hover:text-text px-4 py-2 rounded-lg border border-line transition-colors disabled:opacity-50">
            {t('cancel')}
          </button>
          <button onClick={() => void handleSubmit()} disabled={loading || !canSubmit}
            className="text-sm font-medium btn-gold px-4 py-2 disabled:opacity-50">
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : t('configConfirmSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
