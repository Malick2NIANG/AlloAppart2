import * as fs from 'fs';
import * as path from 'path';
import { parseRegionsSource } from './syncPlaces';
import { PLACES } from './places.data';

describe('places.data.ts — synchronisation avec Frontend/src/lib/regions.ts', () => {
  const frontendRegionsPath = path.resolve(
    __dirname,
    '../../../../Frontend/src/lib/regions.ts',
  );
  const exists = fs.existsSync(frontendRegionsPath);

  if (exists) {
    it('est identique à ce que régénère parseRegionsSource(regions.ts)', () => {
      const sourceText = fs.readFileSync(frontendRegionsPath, 'utf-8');
      expect(PLACES).toEqual(parseRegionsSource(sourceText));
    });
  } else {
    it.skip('ignoré : Frontend/src/lib/regions.ts introuvable depuis ce checkout', () => {});
  }
});
