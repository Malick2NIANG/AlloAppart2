/**
 * Détail lisible d'une erreur renvoyée par l'API (erreurs de validation 400/422
 * de NestJS : `message` est une chaîne ou un tableau de chaînes).
 * Renvoie null pour les autres erreurs (500, réseau…) : on garde alors le
 * message générique plutôt que d'exposer un détail technique.
 */
export function apiErrorDetail(err: unknown): string | null {
  const e = err as { status?: number; data?: { message?: unknown } } | undefined;
  if (!e || (e.status !== 400 && e.status !== 422)) return null;
  const raw = e.data?.message;
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const clean = parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  if (clean.length === 0) return null;
  const joined = clean.join(' · ');
  return joined.length > 300 ? `${joined.slice(0, 297)}…` : joined;
}
