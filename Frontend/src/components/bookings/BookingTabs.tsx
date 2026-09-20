'use client';

/**
 * Barre d'onglets par statut (En attente / Confirmées / Archivées) — même
 * markup pour les 3 rôles, seuls les libellés (traduits par la page
 * appelante) et le contenu diffèrent.
 */
export function BookingTabs<K extends string>({
  tabs, active, onChange,
}: {
  /**
   * `count` absent = pas de badge affiché sur cet onglet. Utile côté admin,
   * dont la liste est paginée côté serveur : seul le total de l'onglet
   * actuellement chargé est connu, pas celui des deux autres tant qu'on n'a
   * pas cliqué dessus.
   */
  tabs: { key: K; label: string; icon: string; count?: number }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            active === tab.key ? 'text-gold-dark' : 'text-sub hover:text-text'
          }`}
        >
          <i className={`fa-solid ${tab.icon} text-xs`} />
          {tab.label}
          {tab.count !== undefined && (
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              active === tab.key ? 'bg-gold-pale text-gold-dark' : 'bg-line text-sub'
            }`}>
              {tab.count}
            </span>
          )}
          {active === tab.key && (
            <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />
          )}
        </button>
      ))}
    </div>
  );
}
