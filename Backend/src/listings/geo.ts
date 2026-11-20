/**
 * Lot « raccourci » (près de moi) — distance à vol d'oiseau (Haversine) et
 * fiabilité des coordonnées stockées. lat/lng sont des `Float` Postgres
 * ordinaires (pas de PostGIS dans ce projet) : le calcul se fait en JS, sur
 * l'ensemble déjà chargé en mémoire par ListingsService.findAll() (même
 * architecture que le tri par score existant, aucune dépendance nouvelle).
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance à vol d'oiseau en km entre deux points (non arrondie). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Boîte englobante généreuse du Sénégal — une annonce en dehors (ou à
// Null Island, 0/0) n'a pas une position fiable pour un tri par distance :
// exclue du tri, jamais une erreur (cf. lot « raccourci » § Backend).
const SENEGAL_BOUNDS = { minLat: 10, maxLat: 18, minLng: -19, maxLng: -10 };

export function hasReliableCoords(lat: number, lng: number): boolean {
  if (lat === 0 && lng === 0) return false;
  return (
    lat >= SENEGAL_BOUNDS.minLat &&
    lat <= SENEGAL_BOUNDS.maxLat &&
    lng >= SENEGAL_BOUNDS.minLng &&
    lng <= SENEGAL_BOUNDS.maxLng
  );
}

/** `null` si les coordonnées de l'annonce ne sont pas fiables — l'appelant
 * exclut alors cette annonce du tri par distance, jamais une erreur. */
export function distanceKmOrNull(
  userLat: number,
  userLng: number,
  listingLat: number,
  listingLng: number,
): number | null {
  if (!hasReliableCoords(listingLat, listingLng)) return null;
  return haversineKm(userLat, userLng, listingLat, listingLng);
}
