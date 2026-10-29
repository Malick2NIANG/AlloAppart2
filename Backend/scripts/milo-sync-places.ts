/**
 * Génère Backend/src/milo/places/places.data.ts à partir de
 * Frontend/src/lib/regions.ts. Le Backend ne peut pas importer le Frontend à
 * l'exécution — ce script lit son code source et le committe en données.
 *
 * Usage : npx ts-node -r tsconfig-paths/register scripts/milo-sync-places.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  parseRegionsSource,
  serializePlacesData,
} from '../src/milo/places/syncPlaces';

const FRONTEND_REGIONS_PATH = path.resolve(
  __dirname,
  '../../Frontend/src/lib/regions.ts',
);
const OUTPUT_PATH = path.resolve(
  __dirname,
  '../src/milo/places/places.data.ts',
);

function main(): void {
  const sourceText = fs.readFileSync(FRONTEND_REGIONS_PATH, 'utf-8');
  const places = parseRegionsSource(sourceText);
  fs.writeFileSync(OUTPUT_PATH, serializePlacesData(places), 'utf-8');
  process.stdout.write(
    `milo-sync-places : ${places.length} régions écrites dans ${OUTPUT_PATH}\n`,
  );
}

main();
