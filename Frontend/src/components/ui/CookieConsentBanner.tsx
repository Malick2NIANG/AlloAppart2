'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'aa_cookie_consent';

/**
 * Bannière d'information sur les cookies — affichée une fois par navigateur
 * (localStorage), acquittement simple. Le site n'utilise aujourd'hui que des
 * cookies nécessaires (session Clerk) et de préférence (thème, langue) —
 * aucun cookie de tracking/analytics optionnel n'est en place, donc pas de
 * choix "accepter/refuser" à proposer pour l'instant. Voir /cookies pour le
 * détail complet ; si un outil d'analytics est ajouté plus tard, cette
 * bannière devra être étendue en véritable choix opt-in/opt-out.
 */
export default function CookieConsentBanner() {
  const t = useTranslations('cookieBanner');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Lecture localStorage différée après hydratation exprès : la lire pendant
    // le rendu initial produirait un mismatch SSR (window absent côté serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-xl sm:flex-row sm:items-center">
        <i className="fa-solid fa-cookie-bite mt-0.5 shrink-0 text-lg text-gold-dark sm:mt-0" />
        <p className="flex-1 text-xs leading-relaxed text-sub sm:text-sm">
          {t('message')}{' '}
          <Link href="/cookies" className="font-medium text-gold-dark hover:underline">
            {t('learnMore')}
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="btn-gold w-full shrink-0 rounded-full px-5 py-2 text-xs font-semibold sm:w-auto"
        >
          {t('accept')}
        </button>
      </div>
    </div>
  );
}
