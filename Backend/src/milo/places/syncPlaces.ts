/**
 * Logique de génération de places.data.ts à partir de Frontend/src/lib/regions.ts
 * (le Backend ne peut pas importer le Frontend à l'exécution — ce module lit son
 * code SOURCE en texte et l'analyse). Utilisée à la fois par le script
 * Backend/scripts/milo-sync-places.ts (génération) et par placesSync.spec.ts
 * (vérifie que places.data.ts committé est à jour).
 */
export interface PlaceRegion {
  /** Nom canonique de région, identique au nom accepté par le filtre `region`. */
  region: string;
  /** Villes canoniques de cette région (champ `cities` de regions.ts). */
  cities: string[];
  /** Quartiers/lieux notables de cette région (champ `highlights` de regions.ts). */
  neighborhoods: string[];
}

function parseStringArrayLiteral(raw: string): string[] {
  const items: string[] = [];
  const re = /'((?:\\.|[^'\\])*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    items.push(m[1].replace(/\\'/g, "'"));
  }
  return items;
}

/** Parse le texte source de regions.ts (`export const REGIONS: RegionData[] = [...]`). */
export function parseRegionsSource(sourceText: string): PlaceRegion[] {
  const arrayMatch = /export const REGIONS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(
    sourceText,
  );
  if (!arrayMatch) {
    throw new Error(
      'REGIONS array introuvable dans regions.ts — format inattendu, synchronisation manuelle requise.',
    );
  }
  const body = arrayMatch[1];
  const blocks = body.match(/\{[^{}]*\}/g) ?? [];
  const places: PlaceRegion[] = [];
  for (const block of blocks) {
    const nameMatch = /\bname:\s*'((?:\\.|[^'\\])*)'/.exec(block);
    const citiesMatch = /\bcities:\s*\[([^\]]*)\]/.exec(block);
    const highlightsMatch = /\bhighlights:\s*\[([^\]]*)\]/.exec(block);
    if (!nameMatch || !citiesMatch) continue;
    places.push({
      region: nameMatch[1].replace(/\\'/g, "'"),
      cities: parseStringArrayLiteral(citiesMatch[1]),
      neighborhoods: highlightsMatch
        ? parseStringArrayLiteral(highlightsMatch[1])
        : [],
    });
  }
  return places;
}

function escapeSingleQuotes(s: string): string {
  return s.replace(/'/g, "\\'");
}

/** Sérialise PlaceRegion[] en code TS déterministe pour places.data.ts. */
export function serializePlacesData(places: PlaceRegion[]): string {
  const blocks = places.map((p) => {
    const cities = p.cities.map((c) => `'${escapeSingleQuotes(c)}'`).join(', ');
    const neighborhoods = p.neighborhoods
      .map((n) => `'${escapeSingleQuotes(n)}'`)
      .join(', ');
    return [
      '  {',
      `    region: '${escapeSingleQuotes(p.region)}',`,
      `    cities: [${cities}],`,
      `    neighborhoods: [${neighborhoods}],`,
      '  },',
    ].join('\n');
  });

  return `/**
 * GÉNÉRÉ — ne pas éditer à la main.
 * Source : Frontend/src/lib/regions.ts (champs \`cities\` + \`highlights\`).
 * Régénérer avec : npx ts-node -r tsconfig-paths/register scripts/milo-sync-places.ts
 */
import type { PlaceRegion } from './syncPlaces';

export const PLACES: PlaceRegion[] = [
${blocks.join('\n')}
];
`;
}
