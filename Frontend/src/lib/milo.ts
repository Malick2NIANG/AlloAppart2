/**
 * Milo Search v0 — lot 5 : appel direct NAVIGATEUR → Backend (jamais via un
 * route handler Next, cf. PLAN_SEARCH_V0.md § 2.d lot 5 — la limite de débit
 * 30/min de POST /search/parse-query est par IP ; passer par le serveur Next
 * la ferait porter sur l'IP du serveur, partagée par tous les visiteurs).
 */
import type {
  DetectedLanguage,
  MiloFaqResult,
  MiloStrictFilters,
  ParseQueryResponse,
} from '@/components/milo/types';
import { getApiBaseUrl } from './runtimeUrls';

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
    const res = await fetch(`${getApiBaseUrl()}/search/parse-query`, {
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
  if (filters.furnished != null) params.furnished = String(filters.furnished);
  if (filters.rentalMode) params.rentalMode = filters.rentalMode;
  if (filters.minPricePerNight != null) params.minPricePerNight = String(filters.minPricePerNight);
  if (filters.maxPricePerNight != null) params.maxPricePerNight = String(filters.maxPricePerNight);
  return params;
}

/**
 * Résolution Milo partagée (lot « loupe du header ») : même logique pour
 * TOUS les points d'entrée (hero, /listings, footer, tiroir mobile, header)
 * — un seul endroit à faire évoluer, jamais de copie de `submit()`. Renvoie
 * les `URLSearchParams` à pousser vers `/listings` (jamais la navigation
 * elle-même : l'appelant choisit `router.push` vs autre, et peut fusionner
 * des paramètres additionnels — ex. min/max saisis à part dans le header).
 *
 * Replis identiques dans les 3 cas (silencieux, jamais d'écran bloquant) :
 * - Milo injoignable/délai dépassé (`null`) → `q` seul.
 * - Milo répond mais n'a rien compris (`understood: false`) → `q` +
 *   `miloMiss=1` + `miloLang` (signal dédié pour /listings).
 * - Compris → strictFilters sérialisés + `milo=1` + `miloLang` + `miloText`
 *   + `miloUnmatched` (CSV) + `prefs` (CSV) si présents.
 */
function buildRedirectParams(
  result: ParseQueryResponse | null,
  text: string,
): URLSearchParams {
  if (!result) {
    return new URLSearchParams({ q: text });
  }

  if (!result.understood) {
    return new URLSearchParams({
      q: text,
      miloMiss: '1',
      miloLang: result.detectedLanguage,
    });
  }

  const params = new URLSearchParams(strictFiltersToParams(result.strictFilters));
  params.set('milo', '1');
  params.set('miloLang', result.detectedLanguage);
  params.set('miloText', text);
  if (result.unmatchedTokens.length > 0) params.set('miloUnmatched', result.unmatchedTokens.join(','));
  if (result.softPreferences.length > 0) params.set('prefs', result.softPreferences.join(','));
  return params;
}

export async function resolveMiloRedirectParams(
  text: string,
  siteLocale: 'fr' | 'en',
): Promise<URLSearchParams> {
  const result = await parseQuery(text, siteLocale);
  return buildRedirectParams(result, text);
}

/**
 * Classification Milo FAQ-aware (lot « Milo FAQ ») : un seul appel réseau,
 * utilisé par TOUS les points d'entrée qui doivent savoir si la réponse est
 * une FAQ (jamais de navigation dans ce cas) ou une redirection classique
 * vers /listings (`resolveMiloRedirectParams`, inchangé, reste utilisé par
 * les appelants qui n'affichent pas de carte FAQ).
 */
export type MiloQueryClassification =
  | { kind: 'faq'; faq: MiloFaqResult; detectedLanguage: DetectedLanguage }
  | { kind: 'redirect'; params: URLSearchParams };

export async function classifyMiloQuery(
  text: string,
  siteLocale: 'fr' | 'en',
): Promise<MiloQueryClassification> {
  const result = await parseQuery(text, siteLocale);
  if (result?.faq) {
    return { kind: 'faq', faq: result.faq, detectedLanguage: result.detectedLanguage };
  }
  return { kind: 'redirect', params: buildRedirectParams(result, text) };
}
