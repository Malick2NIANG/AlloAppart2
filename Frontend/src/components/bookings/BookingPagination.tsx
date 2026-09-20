'use client';

/**
 * Pagination "Précédent / Page X sur Y / Suivant" — même style pour les 3
 * rôles (avant ce lot, l'admin avait son propre style avec chevrons,
 * visuellement différent des deux autres pages).
 */
export function BookingPagination({
  page, pageCount, onPageChange, previousLabel, nextLabel, pageOfLabel,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  pageOfLabel: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
      >
        {previousLabel}
      </button>
      <span className="text-sm text-sub">{pageOfLabel}</span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        className="border border-line bg-card text-sm px-4 py-2 rounded-xl disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );
}
