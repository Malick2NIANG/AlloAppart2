/**
 * AlloVerifieBadge
 * size="sm"  → petit badge inline (corps de carte, fiche annonce…)
 * size="md"  → badge overlay sur image de carte
 */
export default function AlloVerifieBadge({
  className = '',
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  if (size === 'md') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-md ${className}`}
      >
        <i className="fa-solid fa-shield-halved text-[11px]" />
        AlloVérifié
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white ${className}`}
    >
      <i className="fa-solid fa-shield-halved text-[9px]" />
      AlloVérifié
    </span>
  );
}
