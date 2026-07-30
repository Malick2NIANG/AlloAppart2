'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

export default function AdminConfigPage() {
  const { getToken } = useAuth();
  const t = useTranslations('admin');
  const [reindexing, setReindexing]       = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);
  const [reindexError, setReindexError]   = useState<string | null>(null);

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">{t('configTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('configSubtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Plans d'abonnement */}
        <Section title={t('configPlansTitle')} icon="fa-id-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ConfigCard label={t('configPlanStarter')} value={t('configPlanStarterValue')} sub={t('configPlanStarterSub')} />
            <ConfigCard label={t('configPlanPro')}     value={t('configPlanProValue')}     sub={t('configPlanProSub')} />
          </div>
        </Section>

        {/* Commission */}
        <Section title={t('configCommissionTitle')} icon="fa-percent">
          <ConfigCard
            label={t('configCommissionLabel')}
            value={t('configCommissionValue')}
            sub={t('configCommissionSub')}
          />
        </Section>

        {/* AlloVérifié */}
        <Section title={t('configVerifTitle')} icon="fa-shield-halved">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ConfigCard label={t('configAuditBasic')} value={t('configToBeDefined')} sub={t('configAuditBasicSub')} />
            <ConfigCard label={t('configAuditFull')}  value={t('configToBeDefined')} sub={t('configAuditFullSub')} />
          </div>
        </Section>

        {/* Boost annonces */}
        <Section title={t('configBoostTitle')} icon="fa-rocket">
          <ConfigCard label={t('configBoostLabel')} value={t('configBoostValue')} sub={t('configBoostSub')} />
        </Section>

        {/* Meilisearch */}
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
                <p className="mt-1.5 text-xs font-medium text-emerald-600">
                  <i className="fa-solid fa-circle-check mr-1" />{reindexResult}
                </p>
              )}
              {reindexError && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{reindexError}</p>
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
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
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

function ConfigCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-4 py-3">
      <p className="text-xs text-sub mb-0.5">{label}</p>
      <p className="text-base font-bold text-text">{value}</p>
      <p className="text-xs text-sub mt-0.5">{sub}</p>
    </div>
  );
}
