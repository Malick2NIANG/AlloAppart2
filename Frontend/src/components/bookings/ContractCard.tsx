'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Contract } from '@/types';

interface Props {
  bookingId: string;
  /** Rôle du visiteur pour CETTE réservation — adapte le libellé de la note d'info. */
  viewerRole: 'tenant' | 'landlord';
}

export default function ContractCard({ bookingId, viewerRole }: Props) {
  const { getToken } = useAuth();
  const t = useTranslations('contract');

  const [contract, setContract]         = useState<Contract | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [downloading, setDownloading]   = useState(false);
  // Distinct de `error` (qui remplace toute la carte par un message) — une
  // erreur de téléchargement ponctuelle ne doit pas cacher le reste de la
  // carte, juste s'afficher en ligne sous le bouton.
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const retriedRef = useRef(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<Contract | null>(`/contracts/booking/${bookingId}`, token);
      setContract(data);
      setError(null);
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [bookingId, getToken, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Avant : simple <a href> vers l'URL Cloudinary brute. Ce compte Cloudinary
  // refuse l'accès public aux ressources raw/PDF (401 constaté par
  // l'utilisateur dans les devtools réseau) — l'URL stockée n'est donc PAS
  // appelable directement depuis le navigateur, contrairement à ce qu'une
  // tentative précédente supposait. Fix : passer par notre propre API
  // (authentifiée avec le token Clerk), qui signe l'URL Cloudinary côté
  // serveur et retransmet le PDF — exactement le même mécanisme que le reçu
  // de paiement (fetch avec Bearer token → blob → téléchargement forcé).
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/contracts/booking/${bookingId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('error');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `contrat-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(t('downloadError'));
      setTimeout(() => setDownloadError(null), 4000);
    } finally {
      setDownloading(false);
    }
  };

  // Le contrat est généré en tâche de fond juste après le paiement — un
  // court délai est normal. Un seul re-essai automatique, pas de polling continu.
  useEffect(() => {
    if (!loading && !contract && !error && !retriedRef.current) {
      retriedRef.current = true;
      const timer = setTimeout(() => void load(), 4000);
      return () => clearTimeout(timer);
    }
  }, [loading, contract, error, load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 animate-pulse h-20" />
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 p-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
        <i className="fa-solid fa-circle-exclamation text-xs" />
        {error}
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 flex items-center gap-2 text-sm text-sub">
        <i className="fa-solid fa-spinner fa-spin text-xs text-gold-dark" />
        {t('generatingContract')}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <i className="fa-solid fa-file-signature text-gold-dark text-xs" />
          {t('title')}
        </h3>
      </div>

      {contract.pdfUrl && (
        <div>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="btn-gold inline-flex items-center gap-2 text-xs py-2 px-4 disabled:opacity-50"
          >
            <i className={`fa-solid ${downloading ? 'fa-spinner fa-spin' : 'fa-download'}`} />
            {t('downloadBtn')}
          </button>
          {downloadError && (
            <p className="mt-1.5 text-xs text-red-500">{downloadError}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gold/30 bg-gold-pale/50 p-3.5 space-y-1.5">
        <p className="text-xs text-gold-dark font-medium flex items-center gap-1.5">
          <i className="fa-solid fa-circle-info text-xs" />
          {t('infoNoteTitle')}
        </p>
        <p className="text-xs text-sub">
          {viewerRole === 'tenant' ? t('infoNoteTenant') : t('infoNoteLandlord')}
        </p>
      </div>
    </div>
  );
}
