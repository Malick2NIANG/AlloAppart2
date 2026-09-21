'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'aa_cookie_consent';
// Variable CSS lue par globals.css (règle `.dashboard-viewport`, cf.
// DashboardShell.tsx) pour réduire la hauteur réelle de la coquille
// dashboard de la hauteur de la bannière tant qu'elle est visible.
const CSS_VAR = '--cookie-banner-h';

/**
 * Bannière d'information sur les cookies — affichée une fois par navigateur
 * (localStorage), acquittement simple. Le site n'utilise aujourd'hui que des
 * cookies nécessaires (session Clerk) et de préférence (thème, langue) —
 * aucun cookie de tracking/analytics optionnel n'est en place, donc pas de
 * choix "accepter/refuser" à proposer pour l'instant. Voir /cookies pour le
 * détail complet ; si un outil d'analytics est ajouté plus tard, cette
 * bannière devra être étendue en véritable choix opt-in/opt-out.
 *
 * Étant en `position: fixed`, elle est retirée du flux normal et ne réserve
 * donc naturellement aucun espace : sur une page courte (ex. dernière étape
 * de /become-bailleur), son bouton d'action peut se retrouver exactement
 * sous la bannière et devenir inaccessible au clic pour tout premier
 * visiteur (bug détecté via le test E2E admin-bookings — la bannière
 * interceptait les clics destinés à "Activer mon espace bailleur"). Ajouter
 * un simple padding/spacer en fin de page ne suffit pas : sur une page qui
 * tient déjà entièrement à l'écran sans scroll, rien après le bouton ne peut
 * le "pousser" plus haut. On réduit donc dynamiquement, via une variable CSS
 * sur <html>, la hauteur réelle de la coquille dashboard tant que la
 * bannière est visible (cf. `.dashboard-viewport` dans globals.css) — cela
 * force un vrai scroll qui s'arrête pile au-dessus de la bannière.
 */
export default function CookieConsentBanner() {
  const t = useTranslations('cookieBanner');
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Lecture localStorage différée après hydratation exprès : la lire pendant
    // le rendu initial produirait un mismatch SSR (window absent côté serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const el = ref.current;
    if (!el) return;

    const applyBannerHeight = () => {
      document.documentElement.style.setProperty(CSS_VAR, `${el.offsetHeight}px`);
    };
    applyBannerHeight();

    // La hauteur change selon la largeur (colonne sur mobile, ligne dès `sm:`)
    // et le retour à la ligne du texte selon la langue — on la réévalue à
    // chaque redimensionnement plutôt que de la figer une fois pour toutes.
    const observer = new ResizeObserver(applyBannerHeight);
    observer.observe(el);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(CSS_VAR);
    };
  }, [visible]);

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4">
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
