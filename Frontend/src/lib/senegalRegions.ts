/**
 * Lien région ↔ position sur la carte, sans service externe ni coût :
 * - `REGION_CENTERS` : centre (chef-lieu) de chacune des 14 régions, pour recentrer
 *   la carte quand on choisit une région ;
 * - `findRegionAt` : région contenant un point, par calcul « point dans polygone »
 *   sur les contours embarqués dans `src/data/senegal-regions.json`.
 *
 * Tant que le fichier de contours est vide (FeatureCollection sans feature),
 * `hasRegionData` vaut false et `findRegionAt` renvoie toujours null : les
 * formulaires retombent alors sur le comportement précédent (aucune détection,
 * aucun avertissement).
 */
// Import relatif (et non « @/ ») : Vitest n'a pas d'alias pour les fichiers JSON.
import regionsGeoJson from '../data/senegal-regions.json';

export type Position = [lng: number, lat: number];
type Ring = Position[];

interface RegionFeature {
  type: 'Feature';
  properties: { name?: string; shapeName?: string; NAME_1?: string } & Record<string, unknown>;
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

/** Noms exacts utilisés dans les formulaires (SENEGAL_REGIONS) → centre + zoom. */
export const REGION_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'Dakar':        { lat: 14.6937, lng: -17.4441, zoom: 11 },
  'Thiès':        { lat: 14.7886, lng: -16.926,  zoom: 10 },
  'Saint-Louis':  { lat: 16.0179, lng: -16.4896, zoom: 10 },
  'Ziguinchor':   { lat: 12.5833, lng: -16.2719, zoom: 10 },
  'Kaolack':      { lat: 14.15,   lng: -16.0833, zoom: 10 },
  'Fatick':       { lat: 14.339,  lng: -16.4111, zoom: 10 },
  'Kolda':        { lat: 12.8833, lng: -14.95,   zoom: 10 },
  'Tambacounda':  { lat: 13.7667, lng: -13.6667, zoom: 9  },
  'Matam':        { lat: 15.6559, lng: -13.2554, zoom: 9  },
  'Kaffrine':     { lat: 14.1052, lng: -15.5508, zoom: 10 },
  'Sédhiou':      { lat: 12.7081, lng: -15.5569, zoom: 10 },
  'Kédougou':     { lat: 12.5579, lng: -12.1743, zoom: 10 },
  'Louga':        { lat: 15.6167, lng: -16.2167, zoom: 10 },
  'Diourbel':     { lat: 14.65,   lng: -16.2333, zoom: 10 },
};

/** « Thiès Region », « THIES », « Sedhiou » → « thies » : clé de rapprochement. */
function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bregion\b|\bde\b|\bdu\b|\bdes\b/g, '')
    .replace(/[^a-z]/g, '');
}

const CANONICAL_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.keys(REGION_CENTERS).map((name) => [normalizeName(name), name]),
);

const features: RegionFeature[] = ((regionsGeoJson as unknown as { features?: RegionFeature[] }).features ?? []).filter(
  (f) => f?.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
);

/** Vrai quand les contours sont présents (sinon aucune détection n'est possible). */
export const hasRegionData = features.length > 0;

function featureRegionName(f: RegionFeature): string | null {
  const raw = f.properties?.name ?? f.properties?.shapeName ?? f.properties?.NAME_1;
  return typeof raw === 'string' ? (CANONICAL_BY_KEY[normalizeName(raw)] ?? null) : null;
}

/** Algorithme du rayon : le point est-il dans l'anneau ? (coordonnées [lng, lat]) */
function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !inRing(lng, lat, rings[0])) return false;
  // Les anneaux suivants sont des trous.
  for (let k = 1; k < rings.length; k++) if (inRing(lng, lat, rings[k])) return false;
  return true;
}

function featureContains(f: RegionFeature, lng: number, lat: number): boolean {
  return f.geometry.type === 'Polygon'
    ? inPolygon(lng, lat, f.geometry.coordinates)
    : f.geometry.coordinates.some((poly) => inPolygon(lng, lat, poly));
}

/** Région (nom canonique des formulaires) contenant ce point, ou null (hors Sénégal / pas de données). */
export function findRegionAt(lat: number, lng: number): string | null {
  if (!hasRegionData || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const f of features) {
    if (featureContains(f, lng, lat)) return featureRegionName(f);
  }
  return null;
}

/** Distance (km) d'un point à un segment, en projection plane locale (suffisant à l'échelle d'une frontière). */
function distToSegmentKm(lat: number, lng: number, a: Position, b: Position): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  const px = lng * kx, py = lat * ky;
  const ax = a[0] * kx, ay = a[1] * ky;
  const bx = b[0] * kx, by = b[1] * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance minimale (km) d'un point à la frontière d'une région. */
function distanceToRegionBorderKm(f: RegionFeature, lat: number, lng: number): number {
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let min = Infinity;
  for (const rings of polygons) {
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        min = Math.min(min, distToSegmentKm(lat, lng, ring[j], ring[i]));
      }
    }
  }
  return min;
}

/** Marge près des frontières : les contours simplifiés ne sont pas précis au mètre. */
export const REGION_BORDER_TOLERANCE_KM = 3;

export type RegionCheck =
  | { ok: true }
  | { ok: false; reason: 'mismatch'; detected: string }
  | { ok: false; reason: 'outside' };

/**
 * Le point appartient-il à la région choisie ? Sans contours embarqués, ou sans
 * région/point renseigné, on ne bloque rien. Un point à moins de
 * REGION_BORDER_TOLERANCE_KM de la frontière de la région choisie est accepté.
 */
export function checkRegionConsistency(
  region: string | undefined | null,
  lat: number | undefined | null,
  lng: number | undefined | null,
): RegionCheck {
  if (!hasRegionData || !region || lat == null || lng == null) return { ok: true };
  const chosen = getRegionFeature(region);
  if (!chosen) return { ok: true }; // région inconnue des contours : pas de blocage
  const detected = findRegionAt(lat, lng);
  if (detected === region) return { ok: true };
  if (distanceToRegionBorderKm(chosen, lat, lng) <= REGION_BORDER_TOLERANCE_KM) return { ok: true };
  return detected ? { ok: false, reason: 'mismatch', detected } : { ok: false, reason: 'outside' };
}

/** Contour d'une région (pour le surligner sur la carte), ou null. */
export function getRegionFeature(region: string | undefined | null): RegionFeature | null {
  if (!region || !hasRegionData) return null;
  return features.find((f) => featureRegionName(f) === region) ?? null;
}
