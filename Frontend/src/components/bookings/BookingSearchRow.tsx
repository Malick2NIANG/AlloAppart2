'use client';

/**
 * Barre "recherche + nombre de lignes par page" — même markup pour les 3
 * rôles. `perPageOptions` diffère (6/12/24 pour les vues carte, 10/20/50
 * pour l'admin) mais le composant est identique.
 */
export function BookingSearchRow({
  search, onSearchChange, searchPlaceholder,
  perPage, onPerPageChange, perPageOptions, rowsLabel,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  perPage: number;
  onPerPageChange: (n: number) => void;
  perPageOptions: readonly number[];
  rowsLabel: string;
}) {
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="relative flex-1 max-w-sm">
        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-sm pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-line bg-card pl-10 pr-10 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-1 focus:ring-gold-dark transition"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text transition"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-sub whitespace-nowrap">{rowsLabel}</span>
        <div className="flex gap-1">
          {perPageOptions.map((n) => (
            <button
              key={n}
              onClick={() => onPerPageChange(n)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                perPage === n ? 'bg-gold-dark text-white' : 'border border-line bg-bg text-sub hover:text-text'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
