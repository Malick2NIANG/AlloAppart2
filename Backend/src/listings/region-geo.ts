/**
 * Cohérence région ↔ coordonnées (miroir de Frontend/src/lib/senegalRegions.ts).
 *
 * Les contours sont lus dans `data/senegal-regions.json`. Tant que ce fichier est
 * vide, `checkRegionConsistency` ne bloque rien (même comportement que le
 * frontend). Le fichier est copié dans `dist/` via `assets` (nest-cli.json).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

type Position = [number, number]; // [lng, lat]
type Ring = Position[];

export interface RegionFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

/** Noms de région acceptés (identiques à la liste des formulaires). */
export const REGION_NAMES = [
  'Dakar',
  'Thiès',
  'Saint-Louis',
  'Ziguinchor',
  'Kaolack',
  'Fatick',
  'Kolda',
  'Tambacounda',
  'Matam',
  'Kaffrine',
  'Sédhiou',
  'Kédougou',
  'Louga',
  'Diourbel',
] as const;

/** Marge près des frontières : les contours simplifiés ne sont pas précis au mètre. */
export const REGION_BORDER_TOLERANCE_KM = 3;

export type RegionCheck =
  | { ok: true }
  | { ok: false; reason: 'mismatch'; detected: string }
  | { ok: false; reason: 'outside' };

function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bregion\b|\bde\b|\bdu\b|\bdes\b/g, '')
    .replace(/[^a-z]/g, '');
}

const CANONICAL_BY_KEY: Record<string, string> = Object.fromEntries(
  REGION_NAMES.map((name) => [normalizeName(name), name]),
);

export function loadRegionFeatures(): RegionFeature[] {
  try {
    const raw = readFileSync(
      join(__dirname, 'data', 'senegal-regions.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as { features?: RegionFeature[] };
    return (parsed.features ?? []).filter(
      (f) =>
        f?.geometry &&
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
    );
  } catch {
    return []; // fichier absent/illisible : pas de contrôle (jamais bloquant)
  }
}

const DEFAULT_FEATURES = loadRegionFeatures();

function featureRegionName(f: RegionFeature): string | null {
  const p = f.properties ?? {};
  const raw = p['name'] ?? p['shapeName'] ?? p['NAME_1'];
  return typeof raw === 'string'
    ? (CANONICAL_BY_KEY[normalizeName(raw)] ?? null)
    : null;
}

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !inRing(lng, lat, rings[0])) return false;
  for (let k = 1; k < rings.length; k++)
    if (inRing(lng, lat, rings[k])) return false;
  return true;
}

function featureContains(f: RegionFeature, lng: number, lat: number): boolean {
  return f.geometry.type === 'Polygon'
    ? inPolygon(lng, lat, f.geometry.coordinates)
    : f.geometry.coordinates.some((poly) => inPolygon(lng, lat, poly));
}

function distToSegmentKm(
  lat: number,
  lng: number,
  a: Position,
  b: Position,
): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  const px = lng * kx,
    py = lat * ky;
  const ax = a[0] * kx,
    ay = a[1] * ky;
  const bx = b[0] * kx,
    by = b[1] * ky;
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToBorderKm(
  f: RegionFeature,
  lat: number,
  lng: number,
): number {
  const polygons =
    f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
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

export function findRegionAt(
  lat: number,
  lng: number,
  features: RegionFeature[] = DEFAULT_FEATURES,
): string | null {
  if (features.length === 0 || !Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  for (const f of features) {
    if (featureContains(f, lng, lat)) return featureRegionName(f);
  }
  return null;
}

/**
 * La position appartient-elle à la région déclarée ? Sans contours chargés, ou
 * sans région/position, on ne bloque rien. Un point à moins de
 * REGION_BORDER_TOLERANCE_KM de la frontière de la région déclarée est accepté.
 */
export function checkRegionConsistency(
  region: string | undefined | null,
  lat: number | undefined | null,
  lng: number | undefined | null,
  features: RegionFeature[] = DEFAULT_FEATURES,
): RegionCheck {
  if (features.length === 0 || !region || lat == null || lng == null)
    return { ok: true };
  const chosen = features.find((f) => featureRegionName(f) === region);
  if (!chosen) return { ok: true };
  const detected = findRegionAt(lat, lng, features);
  if (detected === region) return { ok: true };
  if (distanceToBorderKm(chosen, lat, lng) <= REGION_BORDER_TOLERANCE_KM)
    return { ok: true };
  return detected
    ? { ok: false, reason: 'mismatch', detected }
    : { ok: false, reason: 'outside' };
}
