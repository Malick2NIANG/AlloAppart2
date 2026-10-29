/**
 * Milo Search v0 — lot 5 : appel direct NAVIGATEUR → Backend (jamais via un
 * route handler Next, cf. PLAN_SEARCH_V0.md § 2.d lot 5 — la limite de débit
 * 30/min de POST /search/parse-query est par IP ; passer par le serveur Next
 * la ferait porter sur l'IP du serveur, partagée par tous les visiteurs).
 */
import type { MiloStrictFilters, ParseQueryResponse } from '@/components/milo/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const TIMEOUT_MS = 4000;

/**
 * Renvoie la réponse de Milo, ou `null` au dépassement du délai (4 s) ou en
 * cas d'erreur réseau/HTTP — l'appelant doit alors replier silencieusement
 * sur la recherche classique (jamais d'écran bloquant, cf. plan).
 */
export async function parseQuery(
  text: string,
  defaultLocale: 'fr' | 'en',
): Promise<ParseQueryResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/search/parse-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, defaultLocale }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as ParseQueryResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sérialise les strictFilters exactement comme les filtres manuels
 * existants (ListingsFilters.tsx `push`) : mêmes noms de champs que
 * FilterListingsDto, amenities en CSV — GET /listings les consomme tels
 * quels, sans traduction côté Frontend.
 */
export function strictFiltersToParams(filters: MiloStrictFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.region) params.region = filters.region;
  if (filters.cityContains) params.cityContains = filters.cityContains;
  if (filters.type) params.type = filters.type;
  if (filters.transactionType) params.transactionType = filters.transactionType;
  if (filters.minPrice != null) params.minPrice = String(filters.minPrice);
  if (filters.maxPrice != null) params.maxPrice = String(filters.maxPrice);
  if (filters.minRooms != null) params.minRooms = String(filters.minRooms);
  if (filters.maxRooms != null) params.maxRooms = String(filters.maxRooms);
  if (filters.minBeds != null) params.minBeds = String(filters.minBeds);
  if (filters.maxBeds != null) params.maxBeds = String(filters.maxBeds);
  if (filters.amenities?.length) params.amenities = filters.amenities.join(',');
  return params;
}
