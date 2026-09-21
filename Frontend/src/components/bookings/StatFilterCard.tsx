'use client';

/**
 * Carte stat cliquable servant aussi de filtre — pattern introduit sur la
 * page Signalements (admin) : icône + valeur + libellé, état actif visible
 * (bordure + fond dorés + indicateur "Sélectionné"), même gabarit que
 * BookingTabs mais en cartes plutôt qu'en onglets pills. `label`/
 * `selectedLabel` sont fournis déjà traduits par la page appelante (même
 * convention que BookingTabs).
 */
export function StatFilterCard({
  icon, label, value, color, bg, active, onClick, selectedLabel,
}: {
  icon: string;
  label: string;
  value: number;
  /** Classe(s) Tailwind de couleur du texte/icône (ex. 'text-amber-600 dark:text-amber-400'). */
  color: string;
  /** Classe(s) Tailwind de fond du chip icône (ex. 'bg-amber-50 dark:bg-amber-950/30'). */
  bg: string;
  active: boolean;
  onClick: () => void;
  selectedLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 flex items-center gap-3 text-left transition-colors ${
        active ? 'border-gold-dark bg-gold-pale/30' : 'border-line bg-card hover:border-gold-dark/40'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <i className={`fa-solid ${icon} ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-text">{value}</p>
        <p className="text-xs text-sub truncate">{label}</p>
        {active && <p className="text-[11px] text-gold-dark font-medium mt-0.5">{selectedLabel}</p>}
      </div>
    </button>
  );
}
