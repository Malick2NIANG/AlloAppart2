'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';

export default function AdminConfigPage() {
  const { getToken } = useAuth();
  const [reindexing, setReindexing]     = useState(false);
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
      setReindexResult(`${res.indexed} annonces réindexées`);
    } catch (err) {
      setReindexError(err instanceof Error ? err.message : 'Erreur lors de la réindexation');
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Configuration</h1>
        <p className="mt-1 text-sm text-sub">Paramètres de la plateforme — lecture seule, modification via variables d&apos;environnement</p>
      </div>

      <div className="space-y-6">
        {/* Plans d'abonnement */}
        <Section title="Plans d'abonnement PRO_AGENCE" icon="fa-id-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ConfigCard label="Plan STARTER" value="75 000 FCFA / mois" sub="Jusqu'à 10 annonces actives" />
            <ConfigCard label="Plan PRO" value="150 000 FCFA / mois" sub="Annonces illimitées + priorité" />
          </div>
        </Section>

        {/* Commission */}
        <Section title="Commission bailleur individuel" icon="fa-percent">
          <ConfigCard
            label="Taux de commission"
            value="0,5 mois de loyer"
            sub="Prélevé à chaque signature de bail confirmée"
          />
        </Section>

        {/* AlloVérifié */}
        <Section title="Tarifs AlloVérifié" icon="fa-shield-halved">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ConfigCard label="Audit BASIC" value="À définir" sub="Visite rapide, photos, rapport PDF" />
            <ConfigCard label="Audit FULL" value="À définir" sub="Visite complète + mesurages + diagnostics" />
          </div>
        </Section>

        {/* Boost annonces */}
        <Section title="Boost d'annonces" icon="fa-rocket">
          <ConfigCard label="Prix du boost" value="5 000 FCFA" sub="7 jours de mise en avant + +10 points de score" />
        </Section>

        {/* Meilisearch */}
        <Section title="Moteur de recherche (Meilisearch)" icon="fa-magnifying-glass">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 rounded-xl border border-line bg-bg px-4 py-3">
              <p className="text-xs text-sub mb-0.5">Statut</p>
              <p className="text-sm font-medium text-text">
                <i className="fa-solid fa-circle text-emerald-500 text-xs mr-1.5" />Opérationnel
              </p>
            </div>
            <div className="flex-1 rounded-xl border border-line bg-bg px-4 py-3">
              <p className="text-xs text-sub mb-0.5">Index principal</p>
              <p className="text-sm font-mono text-text">listings</p>
            </div>
            <div className="shrink-0">
              <p className="text-xs text-sub mb-1.5">Réindexation manuelle</p>
              <button
                onClick={handleReindex}
                disabled={reindexing}
                className="text-xs font-medium border border-line bg-card px-4 py-2 rounded-lg text-text hover:bg-bg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {reindexing
                  ? <><i className="fa-solid fa-spinner fa-spin mr-1.5 text-xs" />Réindexation...</>
                  : <><i className="fa-solid fa-rotate mr-1.5 text-xs" />Réindexer</>}
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
          Pour modifier ces valeurs, mettez à jour les variables d&apos;environnement (
          <code className="font-mono text-xs">.env</code>) et redéployez le backend. Un panneau d&apos;édition en temps réel est prévu dans une prochaine version.
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
