'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import BottomSheet from '@/components/ui/BottomSheet';
import { FlagIcon } from '@/components/ui/LanguageSwitcher';

/** Champs du formulaire pertinents pour la génération — mêmes noms que
 * Backend/src/milo/writer/types.ts (WriterInput, sans `locale`). */
export interface MiloWriterFields {
  type: string;
  transactionType?: string;
  rentalMode?: string;
  city?: string;
  region?: string;
  surface?: number;
  rooms?: number;
  beds?: number;
  baths?: number;
  amenities?: string[];
  furnished?: boolean;
  price?: number;
  pricePerNight?: number;
  depositMonths?: number;
  minLeaseMonths?: number;
  cleaningFee?: number;
  chargesIncluded?: boolean;
  minimumNights?: number;
  maximumNights?: number;
}

interface Props {
  fields: MiloWriterFields;
  /** Valeur actuelle du champ description — jamais écrasée sans confirmation. */
  currentDescription: string;
  onApply: (text: string) => void;
  getToken: () => Promise<string | null | undefined>;
  /** Langue par défaut de la description générée — locale de l'interface. */
  defaultLocale: 'fr' | 'en';
  className?: string;
}

interface WriteDescriptionResponse {
  text: string;
  fallback: boolean;
}

/**
 * Lot « Milo Writer v0 » — bouton « Proposer une description », dans
 * l'étape description de /publier et de l'édition d'annonce. Génération
 * déterministe côté Backend (aucun appel externe, coût zéro) ; ce
 * composant ne fait que l'appel, la confirmation d'écrasement et
 * l'application du texte — jamais d'invention ici non plus (le texte
 * reçu est utilisé tel quel, jamais complété côté client).
 */
export default function MiloWriterButton({ fields, currentDescription, onApply, getToken, defaultLocale, className = '' }: Props) {
  const t = useTranslations('miloWriter');
  const [genLocale, setGenLocale] = useState<'fr' | 'en'>(defaultLocale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState('');
  const [pendingText, setPendingText] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const canGenerate = Boolean(fields.type) && Boolean(fields.city && fields.city.trim().length > 0);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 6000);
  };

  const applyText = (text: string) => {
    onApply(text);
    showNotice(t('proposalApplied'));
  };

  const handleClick = async () => {
    if (!canGenerate || loading) return;
    setLoading(true);
    setError(false);
    try {
      const token = await getToken().catch(() => undefined);
      const res = await api.post<WriteDescriptionResponse>(
        '/milo/write-description',
        { ...fields, locale: genLocale },
        token ?? undefined,
      );
      if (currentDescription.trim().length > 0) {
        setPendingText(res.text);
      } else {
        applyText(res.text);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const closeSheet = () => setPendingText(null);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2.5">
        <div
          role="radiogroup"
          aria-label={t('languageLabel')}
          className="inline-flex shrink-0 overflow-hidden rounded-full border border-line"
        >
          {(['fr', 'en'] as const).map((loc) => {
            const active = genLocale === loc;
            return (
              <button
                key={loc}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={loc === 'fr' ? t('languageFr') : t('languageEn')}
                onClick={() => setGenLocale(loc)}
                className={`flex touch-manipulation items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors max-md:min-h-11 ${
                  active ? 'bg-gold text-[#1c1c1c]' : 'bg-card text-sub hover:text-text'
                }`}
              >
                <FlagIcon countryCode={loc === 'fr' ? 'fr' : 'gb'} />
                {loc === 'fr' ? t('languageFr') : t('languageEn')}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={!canGenerate || loading}
          title={!canGenerate ? t('missingFields') : undefined}
          className="flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-2 rounded-full border border-gold/50 bg-gold-pale px-4 py-2 text-sm font-semibold text-gold-dark transition-all hover:border-gold disabled:cursor-not-allowed disabled:opacity-50 max-md:w-full sm:flex-none"
        >
          <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-xs`} />
          {loading ? t('buttonLoading') : t('button')}
        </button>
      </div>

      {!canGenerate && (
        <p className="mt-1.5 text-xs text-sub">{t('missingFields')}</p>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <span>{t('errorTitle')}</span>
          <button type="button" onClick={() => void handleClick()} className="font-semibold underline underline-offset-2">
            {t('errorRetry')}
          </button>
        </div>
      )}

      {/* aria-live toujours monté (pas conditionnellement) — indispensable
          pour que le lecteur d'écran annonce bien la mise à jour. */}
      <p aria-live="polite" className={notice ? 'mt-1.5 text-xs text-sub' : 'sr-only'}>
        {notice}
      </p>

      <BottomSheet
        open={pendingText !== null}
        onClose={closeSheet}
        titleId="milo-writer-overwrite-title"
      >
        <h2 id="milo-writer-overwrite-title" className="text-lg font-semibold text-text">
          {t('overwriteTitle')}
        </h2>
        <p className="mt-2 text-sm text-sub">{t('overwriteBody')}</p>

        {pendingText && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold text-gold-dark">{t('proposalLabel')}</p>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-line bg-bg p-3 text-sm text-text whitespace-pre-line">
              {pendingText}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => { if (pendingText) applyText(pendingText); closeSheet(); }}
            className="min-h-11 touch-manipulation rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-[#1c1c1c] transition hover:bg-gold-dark hover:text-white"
          >
            {t('overwriteReplace')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (pendingText) {
                const joined = currentDescription.trim().length > 0
                  ? `${currentDescription}\n\n${pendingText}`
                  : pendingText;
                applyText(joined);
              }
              closeSheet();
            }}
            className="min-h-11 touch-manipulation rounded-full border border-gold/50 px-4 py-2.5 text-sm font-semibold text-gold-dark transition hover:border-gold"
          >
            {t('overwriteAppend')}
          </button>
          <button
            type="button"
            onClick={closeSheet}
            className="min-h-11 touch-manipulation rounded-full px-4 py-2.5 text-sm font-medium text-sub transition hover:text-text"
          >
            {t('overwriteCancel')}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
