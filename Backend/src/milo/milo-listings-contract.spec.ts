import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { extractCriteria } from './extractCriteria';
import { FilterListingsDto } from '../listings/dto/filter-listings.dto';

/**
 * Contrat Milo (lot 4) ↔ GET /listings : tout ce que `strictFilters` peut
 * produire doit être accepté tel quel par FilterListingsDto — sans quoi
 * l'endpoint /search/parse-query renverrait des filtres que le Frontend ne
 * pourrait pas réutiliser.
 *
 * Deux formes testées :
 * 1) les valeurs natives de `strictFilters` (nombres, enum, string[]) —
 *    utile en appel interne direct (pas de passage par une query string).
 * 2) la forme « query string » réelle, telle qu'elle arriverait sur
 *    GET /listings : toutes les valeurs sont des chaînes (les paramètres
 *    HTTP le sont toujours), et `amenities` (string[] côté Milo) devient
 *    une SEULE valeur CSV — c'est la sérialisation que le Frontend doit
 *    utiliser : `amenities: strictFilters.amenities.join(',')`, exactement
 *    comme le transform déjà en place dans FilterListingsDto (identique au
 *    filtre manuel existant).
 */
async function errorPropsForNative(payload: Record<string, unknown>) {
  const dto = plainToInstance(FilterListingsDto, payload);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

function toQueryStringForm(
  strictFilters: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(strictFilters)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = (value as string[]).join(',');
    } else if (typeof value === 'number' || typeof value === 'string') {
      out[key] = String(value);
    }
  }
  return out;
}

const REAL_QUERIES = [
  'F3 climatise a louer sous 400 000',
  'villa avec piscine a vendre entre 80 et 120 millions',
  '2 bedrooms in Almadies under 300k',
  'appart Plateau Dakar',
  'villa a Saly a vendre',
  'maison 3 pieces proche de la mer calme',
  'studio meuble, budget 150k',
  '2 chambres climatisees a Dakar sous 350k',
];

describe('Contrat Milo → FilterListingsDto — strictFilters natifs', () => {
  it.each(REAL_QUERIES)(
    '"%s" : strictFilters natif accepté sans erreur',
    async (q) => {
      const { strictFilters } = extractCriteria(q);
      const props = await errorPropsForNative({ ...strictFilters });
      expect(props).toEqual([]);
    },
  );
});

describe('Contrat Milo → FilterListingsDto — forme query string (CSV pour amenities)', () => {
  it.each(REAL_QUERIES)(
    '"%s" : forme query string acceptée sans erreur',
    async (q) => {
      const { strictFilters } = extractCriteria(q);
      const queryForm = toQueryStringForm({ ...strictFilters });
      const props = await errorPropsForNative(queryForm);
      expect(props).toEqual([]);
    },
  );

  it('amenities : la sérialisation CSV documentée fonctionne et reproduit le tableau initial', async () => {
    const { strictFilters } = extractCriteria(
      'F3 climatise a louer avec wifi et parking sous 400 000',
    );
    expect(strictFilters.amenities).toBeDefined();
    const csv = (strictFilters.amenities as string[]).join(',');
    const dto = plainToInstance(FilterListingsDto, { amenities: csv });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
    expect(dto.amenities).toEqual(strictFilters.amenities);
  });
});

describe('Contrat Milo → FilterListingsDto — chaque champ producible existe sous le même nom', () => {
  // whitelist:true + forbidNonWhitelisted:true (ValidationPipe global,
  // main.ts) rejetterait avec une erreur `property X should not exist` tout
  // champ absent de FilterListingsDto — un test isolé par champ, avec une
  // valeur plausible, confirme donc son existence ET sa validité.
  const perFieldPayload: Record<string, Record<string, string>> = {
    region: { region: 'Dakar' },
    cityContains: { cityContains: 'Almadies' },
    minBeds: { minBeds: '2' },
    maxBeds: { maxBeds: '4' },
    minRooms: { minRooms: '2' },
    maxRooms: { maxRooms: '4' },
    minPrice: { minPrice: '100000' },
    maxPrice: { maxPrice: '500000' },
    type: { type: 'VILLA' },
    transactionType: { transactionType: 'LOCATION' },
    amenities: { amenities: 'wifi,clim' },
  };

  it.each(Object.entries(perFieldPayload))(
    '%s existe et est valide',
    async (field, payload) => {
      const errors = await validate(
        plainToInstance(FilterListingsDto, payload),
      );
      expect(errors.map((e) => e.property)).toEqual([]);
    },
  );
});
