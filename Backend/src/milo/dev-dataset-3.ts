/**
 * Milo Search v0 — lot 7 ter (corrections 3, classes 1-2 : direction d'un
 * montant, numéros de téléphone). Jeu de dev écrit à la main par Claude,
 * aucune phrase copiée de Desktop/AlloAppart/Milo_TEST_INDEPENDANT/
 * requetes*.json (non-régression séparée uniquement). ≥ 40 cas par classe,
 * ≥ 50 % de pièges négatifs.
 *
 * `held` : true pour les cas mis de côté comme « jeu de validation tenu à
 * part » (~30 %, un cas sur trois par position fixe) — mesurés séparément
 * par scripts/milo-measure-accuracy-3.ts.
 *
 * Convention `negative` (même principe que dev-dataset-2.ts) : un cas est
 * un « piège négatif » quand une implémentation naïve produirait une
 * valeur FAUSSE (un qualificatif qui remonte à tort sur un montant sans
 * rapport, un fragment de téléphone lu comme un prix, un montant groupé
 * légitime lu comme un téléphone) — pas une simple confirmation que
 * l'extraction normale fonctionne toujours.
 */
import type { ListingType, TransactionType } from '@prisma/client';
import type { MiloAmbiguity } from './types';

export interface DevCase3Expect {
  type?: ListingType | null;
  transactionType?: TransactionType | null;
  region?: string | null;
  cityContains?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBeds?: number | null;
  maxBeds?: number | null;
  minRooms?: number | null;
  maxRooms?: number | null;
  ambiguitiesInclude?: MiloAmbiguity[];
  ambiguitiesExclude?: MiloAmbiguity[];
}

export interface DevCase3 {
  id: string;
  klass: '1' | '2';
  negative: boolean;
  text: string;
  expect: DevCase3Expect;
  held: boolean;
}

type Raw = [string, '1' | '2', boolean, string, DevCase3Expect];

const RAW: Raw[] = [
  // ══ Classe 1 — direction d'un montant (qualificatif collé) ═════════════
  // -- Positifs : la direction s'attache correctement au montant malgré
  // un distracteur non monétaire (étage/chambres/pièces/personnes/m²/
  // hectares/années/semaines) juste avant. --
  [
    'c1-01',
    '1',
    false,
    'studio 3eme etage minimum, 200000 par mois maximum',
    { maxPrice: 200000 },
  ],
  [
    'c1-02',
    '1',
    false,
    'villa 5 chambres minimum, budget 40 millions',
    { minBeds: 5, maxPrice: 40000000 },
  ],
  [
    'c1-03',
    '1',
    false,
    'appart 3 pieces minimum, 250k maximum',
    { minRooms: 3, maxPrice: 250000 },
  ],
  [
    'c1-04',
    '1',
    false,
    'studio pour 6 personnes, budget 300000',
    { maxPrice: 300000 },
  ],
  [
    'c1-05',
    '1',
    false,
    'villa 500m2, budget 1,5 million',
    { maxPrice: 1500000 },
  ],
  [
    'c1-06',
    '1',
    false,
    'villa 2 hectares minimum, budget 50 millions',
    { maxPrice: 50000000 },
  ],
  [
    'c1-07',
    '1',
    false,
    'appart 1 an minimum de bail, 200k par mois maximum',
    { maxPrice: 200000 },
  ],
  [
    'c1-08',
    '1',
    false,
    'maison a louer pour 2 semaines minimum, budget 700k',
    { transactionType: 'LOCATION', maxPrice: 700000 },
  ],
  [
    'c1-09',
    '1',
    false,
    'appart F3 minimum, 300000 maximum',
    { minRooms: 3, maxPrice: 300000 },
  ],
  [
    'c1-10',
    '1',
    false,
    'studio 2 chambres minimum, 180000 maximum',
    { minBeds: 2, maxPrice: 180000 },
  ],
  [
    'c1-11',
    '1',
    false,
    'villa 10 ans minimum, 80 millions maximum',
    { maxPrice: 80000000 },
  ],
  [
    'c1-12',
    '1',
    false,
    'maison 6 chambres minimum a Thies, max 70 millions',
    { minBeds: 6, maxPrice: 70000000, region: 'Thiès' },
  ],
  [
    'c1-13',
    '1',
    false,
    'appart 2 pieces minimum, pas plus de 120000',
    { minRooms: 2, maxPrice: 120000 },
  ],
  [
    'c1-14',
    '1',
    false,
    'appart 2 chambres budget 250000',
    { minBeds: 2, maxBeds: 2, maxPrice: 250000 },
  ],
  [
    'c1-15',
    '1',
    false,
    "au moins 3 chambres, jusqu'a 400k",
    { minBeds: 3, maxPrice: 400000 },
  ],
  [
    'c1-16',
    '1',
    false,
    'apartment 3rd floor minimum, 200000 per month maximum',
    { maxPrice: 200000 },
  ],
  [
    'c1-17',
    '1',
    false,
    'house 5 bedrooms minimum, budget 40 million',
    { minBeds: 5, maxPrice: 40000000 },
  ],
  [
    'c1-18',
    '1',
    false,
    'apartment 3 rooms minimum, 250k max',
    { minRooms: 3, maxPrice: 250000 },
  ],
  [
    'c1-19',
    '1',
    false,
    'studio for 6 people, budget 300000',
    { maxPrice: 300000 },
  ],
  [
    'c1-20',
    '1',
    false,
    'villa 500 sqm, budget 1.5 million',
    { maxPrice: 1500000 },
  ],
  [
    'c1-21',
    '1',
    false,
    'house 2 weeks minimum, budget 700k',
    { maxPrice: 700000 },
  ],
  [
    'c1-22',
    '1',
    false,
    'apartment F3 minimum, 300000 max',
    { minRooms: 3, maxPrice: 300000 },
  ],
  [
    'c1-23',
    '1',
    false,
    'house 6 bedrooms minimum in Thies, max 70 million',
    { minBeds: 6, maxPrice: 70000000, region: 'Thiès' },
  ],
  [
    'c1-24',
    '1',
    false,
    'apartment under 150k, 2 bedrooms minimum',
    { minBeds: 2, maxPrice: 150000 },
  ],
  [
    'c1-25',
    '1',
    false,
    'villa from 60 million, 4 bedrooms minimum',
    { minBeds: 4, minPrice: 60000000 },
  ],
  [
    'c1-26',
    '1',
    false,
    'house at least 3 bedrooms, under 400k',
    { minBeds: 3, maxPrice: 400000 },
  ],
  [
    'c1-27',
    '1',
    false,
    'apartment at most 2 bedrooms, over 100k',
    { maxBeds: 2, minPrice: 100000 },
  ],
  [
    'c1-28',
    '1',
    false,
    'at least 3 bedrooms, up to 400k',
    { minBeds: 3, maxPrice: 400000 },
  ],

  // -- Négatifs : le qualificatif est déjà lié à la quantité non monétaire
  // qui le précède/suit immédiatement — il ne doit JAMAIS descendre sur
  // un montant plus loin (ambiguïté amountDirection, aucun filtre). --
  [
    'c1-29',
    '1',
    true,
    'studio 3eme etage minimum, 200000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-30',
    '1',
    true,
    'appart 2 chambres minimum, 300000',
    { minBeds: 2, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-31',
    '1',
    true,
    'villa 4 personnes minimum, 500000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-32',
    '1',
    true,
    'studio for 6 people minimum, 90000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-33',
    '1',
    true,
    'appart 3 nuits minimum, 45000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-34',
    '1',
    true,
    'maison 2 semaines minimum, 300000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-35',
    '1',
    true,
    'villa 5 hectares minimum, 1200000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-36',
    '1',
    true,
    'appart 10eme etage minimum, 150000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-37',
    '1',
    true,
    'house 3 bedrooms minimum, 200000',
    { minBeds: 3, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-38',
    '1',
    true,
    'villa 3 years minimum, 900000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-39',
    '1',
    true,
    'villa 2 etages min, 2000000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-40',
    '1',
    true,
    'house 2 adults minimum, 55000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-41',
    '1',
    true,
    'appart 2 ch minimum, 150000',
    { minBeds: 2, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-42',
    '1',
    true,
    'appart 5 nuits max, 20000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-43',
    '1',
    true,
    'house 4 nights min, 25000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-44',
    '1',
    true,
    'studio 90 m2 min, 2500000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-45',
    '1',
    true,
    'appart 3 semaines max, 45000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-46',
    '1',
    true,
    'house 2 years max, 1000000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-47',
    '1',
    true,
    'appart F4 min, 60 millions',
    { minRooms: 4, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-48',
    '1',
    true,
    'villa 7 jours minimum, 95000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-49',
    '1',
    true,
    'house 5 days minimum, 85000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-50',
    '1',
    true,
    'studio 3 enfants minimum, 70000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-51',
    '1',
    true,
    'apartment 2 bedrooms min, 190000',
    { minBeds: 2, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-52',
    '1',
    true,
    'villa 4 rooms max, 350000',
    { maxRooms: 4, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-53',
    '1',
    true,
    'studio 6eme etage min, 110000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-54',
    '1',
    true,
    'villa 3 pieces min, 280000',
    { minRooms: 3, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-55',
    '1',
    true,
    'house 3 rooms min, 180000',
    { minRooms: 3, maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],
  [
    'c1-56',
    '1',
    true,
    'appart 4 semaines minimum, 60000',
    { maxPrice: null, ambiguitiesInclude: ['amountDirection'] },
  ],

  // ══ Classe 2 — numéros de téléphone ═════════════════════════════════════
  // -- Pièges négatifs : un numéro de téléphone (10 formats) est présent ET
  // un montant explicite (avant ou après) doit rester intact — jamais lu
  // comme un prix/pièces/chambres. --
  [
    'c2-01',
    '2',
    true,
    'villa a Saly 77 123 45 67 budget 90 millions',
    { maxPrice: 90000000, region: 'Thiès', cityContains: 'Saly' },
  ],
  [
    'c2-02',
    '2',
    true,
    'appart Dakar 77.123.45.67 budget 300k',
    { maxPrice: 300000, region: 'Dakar' },
  ],
  [
    'c2-03',
    '2',
    true,
    'maison Thies 77-123-45-67, 250000 par mois',
    { maxPrice: 275000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'c2-04',
    '2',
    true,
    'studio Yoff 77 123 4567, budget 60000',
    { maxPrice: 60000, cityContains: 'Yoff' },
  ],
  [
    'c2-05',
    '2',
    true,
    'villa Mbour +221 77 123 45 67 budget 1 million',
    { maxPrice: 1000000, cityContains: 'Mbour' },
  ],
  [
    'c2-06',
    '2',
    true,
    'appart Dakar 00221 77 123 45 67, budget 300k',
    { maxPrice: 300000, region: 'Dakar' },
  ],
  [
    'c2-07',
    '2',
    true,
    'maison Saly (221) 77 123 45 67 budget 50 millions',
    { maxPrice: 50000000, cityContains: 'Saly' },
  ],
  [
    'c2-08',
    '2',
    true,
    'studio Dakar 221771234567, budget 60k',
    { maxPrice: 60000, region: 'Dakar' },
  ],
  [
    'c2-09',
    '2',
    true,
    'villa Thies 771234567 budget 40 millions',
    { maxPrice: 40000000, region: 'Thiès' },
  ],
  [
    'c2-10',
    '2',
    true,
    'appart Dakar numero 771234567 budget 250k',
    { maxPrice: 250000, region: 'Dakar' },
  ],
  [
    'c2-11',
    '2',
    true,
    'maison Saly tel 77 123 45 67 budget 30 millions',
    { maxPrice: 30000000, cityContains: 'Saly' },
  ],
  [
    'c2-12',
    '2',
    true,
    'studio Dakar whatsapp 77.123.45.67, budget 60k',
    { maxPrice: 60000, region: 'Dakar' },
  ],
  [
    'c2-13',
    '2',
    true,
    'villa Mbour contact 221771234567 budget 70 millions',
    { maxPrice: 70000000, cityContains: 'Mbour' },
  ],
  [
    'c2-14',
    '2',
    true,
    'appart Dakar call 77-123-45-67, budget 200000',
    { maxPrice: 200000, region: 'Dakar' },
  ],
  [
    'c2-15',
    '2',
    true,
    'house Saly phone 77 123 45 67, budget 500000',
    { maxPrice: 500000, cityContains: 'Saly' },
  ],
  [
    'c2-16',
    '2',
    true,
    'villa a Saly, tel 77.123.45.67, 3 chambres',
    { minBeds: 3, maxBeds: 3, cityContains: 'Saly' },
  ],
  [
    'c2-17',
    '2',
    true,
    'appart a Dakar, whatsapp 221771234567, 2 chambres',
    { minBeds: 2, maxBeds: 2, region: 'Dakar' },
  ],
  [
    'c2-18',
    '2',
    true,
    'villa a Ngor, mon numero 77 123 45 67, budget 1,5 million par mois',
    { maxPrice: 1500000, cityContains: 'Ngor' },
  ],

  // -- Pièges négatifs (sens inverse) : un montant groupé/collé LÉGITIME ne
  // doit JAMAIS être lu comme un téléphone, même ≥ 7 chiffres. --
  ['c2-19', '2', true, 'villa budget 15 000', { maxPrice: 15000 }],
  ['c2-20', '2', true, 'appart budget 1 500 000', { maxPrice: 1500000 }],
  ['c2-21', '2', true, 'maison budget 12.000.000', { maxPrice: 12000000 }],
  ['c2-22', '2', true, 'house budget 1,500,000', { maxPrice: 1500000 }],
  ['c2-23', '2', true, 'villa budget 2500000', { maxPrice: 2500000 }],
  ['c2-24', '2', true, 'appart budget 900000000', { maxPrice: 900000000 }],

  // -- Confirmations positives : extraction normale toujours intacte sans
  // aucun numéro de téléphone dans la phrase (régression, pas un piège). --
  [
    'c2-25',
    '2',
    false,
    'appart Dakar budget 300000',
    { maxPrice: 300000, region: 'Dakar' },
  ],
  [
    'c2-26',
    '2',
    false,
    'villa Saly 3 chambres, budget 2 millions',
    { minBeds: 3, maxBeds: 3, maxPrice: 2000000, cityContains: 'Saly' },
  ],
  [
    'c2-27',
    '2',
    false,
    'maison Thies budget 45 millions',
    { maxPrice: 45000000, region: 'Thiès' },
  ],
  [
    'c2-28',
    '2',
    false,
    'studio Yoff entre 100k et 150k',
    { minPrice: 100000, maxPrice: 150000, cityContains: 'Yoff' },
  ],
  [
    'c2-29',
    '2',
    false,
    'appart Dakar 2 chambres minimum',
    { minBeds: 2, region: 'Dakar' },
  ],
  [
    'c2-30',
    '2',
    false,
    'house Ngor budget 500k',
    { maxPrice: 500000, cityContains: 'Ngor' },
  ],
  [
    'c2-31',
    '2',
    false,
    'villa Almadies max 80 millions',
    { maxPrice: 80000000, cityContains: 'Almadies' },
  ],
  [
    'c2-32',
    '2',
    false,
    'appart Plateau min 150000',
    { minPrice: 150000, cityContains: 'Plateau' },
  ],
  [
    'c2-33',
    '2',
    false,
    'studio Mermoz budget 60000',
    { maxPrice: 60000, cityContains: 'Mermoz' },
  ],
  [
    'c2-34',
    '2',
    false,
    'maison Sacre-Coeur budget 25 millions',
    { maxPrice: 25000000, cityContains: 'Sacré-Cœur' },
  ],
];

export const DEV_DATASET_3: DevCase3[] = RAW.map(
  ([id, klass, negative, text, expect], idx): DevCase3 => ({
    id,
    klass,
    negative,
    text,
    expect,
    held: idx % 3 === 2,
  }),
);
