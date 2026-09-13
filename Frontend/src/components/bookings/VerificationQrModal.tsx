'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';

interface VerificationQrModalProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
}

/**
 * QR sécurisé que le locataire montre au bailleur en personne (arrivée
 * nuitée, ou pour prouver l'authenticité de son bail mensuel). Le QR pointe
 * vers une page publique (/verifier/:token) que le bailleur scanne avec son
 * téléphone, sans avoir besoin d'un compte AlloAppart ni de se connecter.
 * Le token est signé côté serveur (HMAC) — impossible à falsifier.
 */
export function VerificationQrModal({ open, onClose, bookingId }: VerificationQrModalProps) {
  const t = useTranslations('verification');
  const { getToken } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  // Le token est stable pour une réservation donnée (pas d'horodatage) — une
  // fois récupéré avec succès, pas besoin de le re-fetcher à chaque
  // réouverture du modal ; on ne retente qu'à une nouvelle ouverture après
  // fermeture (pas en boucle sur un même échec).
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      attemptedRef.current = false;
      return;
    }
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('no token');
        const data = await api.get<{ token: string; url: string }>(
          `/bookings/${bookingId}/verification-qr`,
          token,
        );
        if (cancelled) return;
        setUrl(data.url);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, bookingId, getToken]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
              <i className="fa-solid fa-qrcode text-lg text-gold-dark" />
            </div>
            <h2 className="mb-1 text-base font-semibold text-text">{t('modalTitle')}</h2>
            <p className="mb-5 text-sm text-sub">{t('modalInstructions')}</p>

            <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-xl border border-line bg-white p-3">
              {loading && <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />}
              {!loading && error && (
                <i className="fa-solid fa-triangle-exclamation text-2xl text-red-500" />
              )}
              {!loading && !error && url && <QRCodeSVG value={url} size={200} level="M" />}
            </div>

            {!loading && error && (
              <p className="mt-3 text-sm text-red-500">{t('modalError')}</p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg border border-line px-4 py-2 text-sm font-medium text-sub transition-colors hover:text-text"
            >
              {t('close')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
