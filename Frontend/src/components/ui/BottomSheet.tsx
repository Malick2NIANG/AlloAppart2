'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { shouldDismissSheet } from '@/lib/sheetDismiss';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** id de l'élément portant le titre du contenu (ex. le <h2>), pour aria-labelledby. */
  titleId: string;
  /** Feuille pleine hauteur sous 768px (listes imbriquées, ex. assignation d'agent) — sans effet ≥768px. */
  fullHeight?: boolean;
  /** Pied de feuille fixe (hors du défilement du contenu), ex. boutons Appliquer/Réinitialiser — optionnel, inchangé si omis (lot 2a). */
  footer?: React.ReactNode;
  /**
   * Classes du conteneur modal ≥768px — remplace entièrement les classes par
   * défaut (`w-full max-w-md rounded-2xl border border-line bg-card p-6
   * shadow-xl`, celles de ConfirmModal). À fournir uniquement quand une
   * modale migrée vers BottomSheet avait, avant migration, un rendu desktop
   * différent de ConfirmModal (largeur, bordure, ombre…) — pour que le lot
   * mobile ne change RIEN à partir de 768px (règle d'or). Omis : comportement
   * actuel inchangé.
   */
  desktopClassName?: string;
  /** Même principe que `desktopClassName`, pour le fond ≥768px (remplace
   * `fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4`).
   * Omis : comportement actuel inchangé. */
  desktopBackdropClassName?: string;
}

const DEFAULT_DESKTOP_CLASS = 'w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-xl';
const DEFAULT_DESKTOP_BACKDROP_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Vrai si l'élément est effectivement rendu (ni lui ni un ancêtre n'a display:none). */
function isRendered(el: HTMLElement | null): el is HTMLElement {
  return !!el && el.getClientRects().length > 0;
}

/**
 * Feuille modale générique. Sous 768px : feuille collée en bas (glissement
 * pour fermer, hauteur max 90dvh ou pleine hauteur via `fullHeight`). À
 * partir de 768px : modale centrée — mêmes classes que l'implémentation
 * historique de ConfirmModal (règle d'or du lot 0c), portées par un élément
 * dont les classes ne sont jamais modifiées ; seul un conteneur englobant
 * (`hidden md:block`, sans effet sur un enfant `position:fixed`) bascule
 * entre les deux variantes sans détection JS de largeur (SSR-safe).
 */
export default function BottomSheet({ open, onClose, children, titleId, fullHeight = false, footer, desktopClassName, desktopBackdropClassName }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();

  // ── Échap, verrouillage du scroll de la page, focus piégé + restitué ────
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const activeContainer = () =>
      isRendered(sheetRef.current) ? sheetRef.current : desktopContainerRef.current;

    const focusables = activeContainer()?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = activeContainer()?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  // framer-motion donne une vitesse en px/s ; shouldDismissSheet attend du px/ms.
  const handleDragEnd = useCallback((_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
    if (shouldDismissSheet({ dragDistance: info.offset.y, velocity: info.velocity.y / 1000, sheetHeight: height })) {
      onClose();
    }
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Sous 768px : feuille collée en bas ─────────────────────── */}
          <div className="md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-black/50"
              onClick={onClose}
            />
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={handleDragEnd}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 380 }}
              className={`fixed inset-x-0 bottom-0 z-[100] flex flex-col rounded-t-2xl border-t border-line bg-card shadow-xl ${
                fullHeight ? 'h-[100dvh]' : 'max-h-[90dvh]'
              }`}
              style={{ paddingBottom: 'var(--safe-bottom, 0px)' }}
            >
              {/* Poignée visuelle — décorative ; seule zone qui déclenche le
                  glissement (évite tout conflit avec le défilement interne
                  du contenu, cf. dragListener={false} ci-dessus). */}
              <div
                aria-hidden
                className="flex shrink-0 touch-none cursor-grab items-center justify-center py-2.5 active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <span className="h-1.5 w-10 rounded-full bg-line" />
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {children}
              </div>
              {footer && (
                <div className="shrink-0 border-t border-line px-6 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── À partir de 768px : modale centrée — mêmes classes que
              l'implémentation historique de ConfirmModal. Le wrapper
              `hidden md:block` est le seul ajout structurel : sans effet sur
              l'enfant `position:fixed` (ne crée pas de bloc de confinement),
              et ses propres classes ne sont donc jamais modifiées. ── */}
          <div className="hidden md:block">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={desktopBackdropClassName ?? DEFAULT_DESKTOP_BACKDROP_CLASS}
              onClick={onClose}
            >
              <motion.div
                ref={desktopContainerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={desktopClassName ?? DEFAULT_DESKTOP_CLASS}
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
