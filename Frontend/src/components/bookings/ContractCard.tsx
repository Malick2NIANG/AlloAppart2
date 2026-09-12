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

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
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
        <a
          href={contract.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold inline-flex items-center gap-2 text-xs py-2 px-4"
        >
          <i className="fa-solid fa-download" />
          {t('downloadBtn')}
        </a>
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
