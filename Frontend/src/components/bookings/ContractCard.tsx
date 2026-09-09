'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Contract, ContractStatus } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const MAX_PDF_SIZE = 16 * 1024 * 1024; // 16 Mo — aligné sur la limite backend

interface Props {
  bookingId: string;
  /** Rôle du visiteur pour CETTE réservation — détermine qui doit signer en premier. */
  viewerRole: 'tenant' | 'landlord';
}

const STATUS_STYLES: Record<ContractStatus, string> = {
  DRAFT: 'bg-gold-pale text-gold-dark border-gold/30',
  AWAITING_FIRST_SIGNATURE: 'bg-gold-pale text-gold-dark border-gold/30',
  AWAITING_SECOND_SIGNATURE: 'bg-blue-50 text-blue-700 border-blue-200',
  FULLY_SIGNED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ContractCard({ bookingId, viewerRole }: Props) {
  const { getToken } = useAuth();
  const t = useTranslations('contract');

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = async (file: File) => {
    if (!contract) return;
    if (file.type !== 'application/pdf') {
      setUploadError(t('uploadInvalidType'));
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setUploadError(t('uploadTooLarge'));
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/contracts/${contract.id}/sign`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? t('uploadError'));
      }
      const updated = await res.json() as Contract;
      setContract(updated);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : t('uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4 animate-pulse h-20" />
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center gap-2">
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

  const isTenant = viewerRole === 'tenant';
  const myTurn =
    (contract.status === 'AWAITING_FIRST_SIGNATURE' && isTenant) ||
    (contract.status === 'AWAITING_SECOND_SIGNATURE' && !isTenant);
  const waitingOnOther =
    (contract.status === 'AWAITING_FIRST_SIGNATURE' && !isTenant) ||
    (contract.status === 'AWAITING_SECOND_SIGNATURE' && isTenant);

  const STATUS_LABELS: Record<ContractStatus, string> = {
    DRAFT: t('statusDraft'),
    AWAITING_FIRST_SIGNATURE: t('statusAwaitingFirst'),
    AWAITING_SECOND_SIGNATURE: t('statusAwaitingSecond'),
    FULLY_SIGNED: t('statusFullySigned'),
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <i className="fa-solid fa-file-signature text-gold-dark text-xs" />
          {t('title')}
        </h3>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[contract.status]}`}>
          {STATUS_LABELS[contract.status]}
        </span>
      </div>

      {/* Téléchargements disponibles */}
      <div className="flex flex-wrap gap-2">
        {contract.pdfUrl && (
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sub hover:text-gold-dark border border-line hover:border-gold/40 rounded-lg py-1.5 px-3 transition-colors"
          >
            <i className="fa-solid fa-file-pdf text-xs" />
            {t('downloadDraft')}
          </a>
        )}
        {contract.firstSignedPdfUrl && contract.status !== 'FULLY_SIGNED' && (
          <a
            href={contract.firstSignedPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sub hover:text-gold-dark border border-line hover:border-gold/40 rounded-lg py-1.5 px-3 transition-colors"
          >
            <i className="fa-solid fa-file-pdf text-xs" />
            {t('downloadPreSigned')}
          </a>
        )}
        {contract.finalPdfUrl && (
          <a
            href={contract.finalPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:border-emerald-300 rounded-lg py-1.5 px-3 transition-colors"
          >
            <i className="fa-solid fa-file-circle-check text-xs" />
            {t('downloadFinal')}
          </a>
        )}
      </div>

      {/* Zone d'action selon le tour de signature */}
      {contract.status === 'FULLY_SIGNED' ? (
        <p className="text-xs text-emerald-700 flex items-center gap-1.5">
          <i className="fa-solid fa-circle-check text-xs" />
          {t('fullySignedNote')}
        </p>
      ) : myTurn ? (
        <div className="rounded-xl border border-gold/30 bg-gold-pale/50 p-3.5 space-y-2.5">
          <p className="text-xs text-gold-dark font-medium flex items-center gap-1.5">
            <i className="fa-solid fa-pen-nib text-xs" />
            {isTenant ? t('yourTurnTenant') : t('yourTurnLandlord')}
          </p>
          <p className="text-xs text-sub">{t('signInstructions')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileChange(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-gold text-xs py-2 px-4 disabled:opacity-50"
          >
            {uploading ? (
              <><i className="fa-solid fa-spinner fa-spin mr-1.5" />{t('uploading')}</>
            ) : (
              <><i className="fa-solid fa-upload mr-1.5" />{t('uploadSignedBtn')}</>
            )}
          </button>
          {uploadError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation text-xs" />
              {uploadError}
            </p>
          )}
        </div>
      ) : waitingOnOther ? (
        <p className="text-xs text-sub flex items-center gap-1.5">
          <i className="fa-solid fa-hourglass-half text-xs" />
          {isTenant ? t('waitingOnLandlord') : t('waitingOnTenant')}
        </p>
      ) : null}
    </div>
  );
}
