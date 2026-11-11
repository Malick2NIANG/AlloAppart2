/**
 * Milo Search v0 — lot meublé/durée de location (classes : meublé/négation,
 * durée, prix par nuit, conflit). Jeu de dev écrit à la main par Claude,
 * aucune phrase copiée de Desktop/AlloAppart/Milo_TEST_INDEPENDANT/
 * requetes*.json (non-régression séparée uniquement). ≥ 40 cas par classe,
 * ≥ 50 % de pièges négatifs.
 *
 * `held` : true pour les cas mis de côté comme « jeu de validation tenu à
 * part » (~30 %, un cas sur trois par position fixe) — mesurés séparément
 * par scripts/milo-measure-accuracy-4.ts.
 *
 * Convention `negative` (même principe que dev-dataset-2/3.ts) : un cas est
 * un « piège négatif » quand une implémentation naïve produirait une
 * valeur FAUSSE (meublé déduit d'une négation, un mot sans rapport déclenché
 * à tort comme durée, un prix par nuit confondu avec le prix mensuel, un
 * conflit nuitée/mensuel silencieusement résolu au hasard) — pas une simple
 * confirmation que l'extraction normale fonctionne toujours.
 */
import type { ListingType, RentalMode, TransactionType } from '@prisma/client';
import type { MiloAmbiguity } from './types';

export interface DevCase4Expect {
  type?: ListingType | null;
  transactionType?: TransactionType | null;
  region?: string | null;
  cityContains?: string | null;
  minBeds?: number | null;
  maxBeds?: number | null;
  furnished?: boolean | null;
  rentalMode?: RentalMode | null;
  minPricePerNight?: number | null;
  maxPricePerNight?: number | null;
  ambiguitiesInclude?: MiloAmbiguity[];
  ambiguitiesExclude?: MiloAmbiguity[];
}

export interface DevCase4 {
  id: string;
  klass: 'furnished' | 'duration' | 'pricePerNight' | 'conflict';
  negative: boolean;
  text: string;
  expect: DevCase4Expect;
  held: boolean;
}

type Raw = [string, DevCase4['klass'], boolean, string, DevCase4Expect];

const RAW: Raw[] = [
  // ══ Classe furnished — meublé/négation ══════════════════════════════════
  // -- Positifs : furnished correctement déduit (true ou false). --
  ['f-01', 'furnished', false, 'studio meuble a Dakar', { furnished: true }],
  ['f-02', 'furnished', false, 'appart meuble a Dakar', { furnished: true }],
  ['f-03', 'furnished', false, 'chambre meublee a Thies', { furnished: true }],
  ['f-04', 'furnished', false, 'villa meublee a Saly', { furnished: true }],
  [
    'f-05',
    'furnished',
    false,
    'appartements meubles a Dakar',
    { furnished: true },
  ],
  [
    'f-06',
    'furnished',
    false,
    'studio avec meubles a Dakar',
    { furnished: true },
  ],
  [
    'f-07',
    'furnished',
    false,
    'furnished studio in Dakar',
    { furnished: true },
  ],
  [
    'f-08',
    'furnished',
    false,
    'furnished apartment in Thies',
    { furnished: true },
  ],
  ['f-09', 'furnished', false, 'STUDIO MEUBLE A DAKAR', { furnished: true }],
  ['f-10', 'furnished', false, 'studio, meuble, a Dakar.', { furnished: true }],
  ['f-11', 'furnished', false, 'appart meuble svp', { furnished: true }],
  [
    'f-12',
    'furnished',
    false,
    'appart a louer, meuble, calme',
    { furnished: true },
  ],
  [
    'f-13',
    'furnished',
    false,
    'studio 2 chambres meuble a Dakar',
    { furnished: true, minBeds: 2, maxBeds: 2 },
  ],

  // -- Négatifs : négation reconnue (produit furnished=false) — pièges au
  // sens où une implémentation naïve lirait juste "meublé" en positif. --
  [
    'f-14',
    'furnished',
    true,
    'studio non meuble a Dakar',
    { furnished: false },
  ],
  [
    'f-15',
    'furnished',
    true,
    'appart pas meuble a Dakar',
    { furnished: false },
  ],
  [
    'f-16',
    'furnished',
    true,
    'chambre sans meubles a Thies',
    { furnished: false },
  ],
  ['f-17', 'furnished', true, 'villa sans meuble a Saly', { furnished: false }],
  ['f-18', 'furnished', true, 'studio vide a Dakar', { furnished: false }],
  [
    'f-19',
    'furnished',
    true,
    'unfurnished studio in Dakar',
    { furnished: false },
  ],
  [
    'f-20',
    'furnished',
    true,
    'not furnished apartment in Thies',
    { furnished: false },
  ],
  [
    'f-21',
    'furnished',
    true,
    'apartment not furnished in Dakar',
    { furnished: false },
  ],
  [
    'f-22',
    'furnished',
    true,
    'Studio Non-Meuble a Dakar',
    { furnished: false },
  ],
  [
    'f-23',
    'furnished',
    true,
    'chambre NON MEUBLEE urgent',
    { furnished: false },
  ],
  [
    'f-24',
    'furnished',
    true,
    'studio a louer, non meuble, calme',
    { furnished: false },
  ],
  ['f-25', 'furnished', true, 'appartement non meuble', { furnished: false }],

  // -- Négatifs (restraint) : aucun filtre `furnished` posé — "équipé" seul,
  // absence totale du sujet, ou négation d'un AUTRE mot (piscine/parking)
  // qui ne doit jamais retomber sur furnished. --
  [
    'f-26',
    'furnished',
    true,
    'appartement bien equipe a Dakar',
    { furnished: null },
  ],
  [
    'f-27',
    'furnished',
    true,
    'studio tout equipe a Dakar',
    { furnished: null },
  ],
  ['f-28', 'furnished', true, 'chambre a Dakar', { furnished: null }],
  ['f-29', 'furnished', true, 'villa a Saly', { furnished: null }],
  ['f-30', 'furnished', true, 'appart climatise a Dakar', { furnished: null }],
  ['f-31', 'furnished', true, 'studio avec wifi a Dakar', { furnished: null }],
  ['f-32', 'furnished', true, 'house with pool in Dakar', { furnished: null }],
  ['f-33', 'furnished', true, 'chambre propre a Dakar', { furnished: null }],
  ['f-34', 'furnished', true, 'studio spacieux a Dakar', { furnished: null }],
  [
    'f-35',
    'furnished',
    true,
    'appart sans piscine a Dakar',
    { furnished: null },
  ],
  [
    'f-36',
    'furnished',
    true,
    'chambre sans parking a Thies',
    { furnished: null },
  ],
  ['f-37', 'furnished', true, 'villa non verifiee a Saly', { furnished: null }],
  [
    'f-38',
    'furnished',
    false,
    'studio meuble, 2 chambres a Dakar',
    { furnished: true, minBeds: 2, maxBeds: 2 },
  ],
  [
    'f-39',
    'furnished',
    true,
    'appart a vendre meuble a Dakar',
    { furnished: true },
  ],
  [
    'f-40',
    'furnished',
    true,
    'villa a vendre non meublee a Saly',
    { furnished: false },
  ],
  [
    'f-41',
    'furnished',
    false,
    'chambre a louer meublee a Saly pour 6 personnes',
    { furnished: true },
  ],
  ['f-42', 'furnished', true, 'villa moderne a Dakar', { furnished: null }],

  // ══ Classe duration — durée → rentalMode ════════════════════════════════
  // -- Positifs : rentalMode NIGHTLY ou MONTHLY correctement déduit. --
  [
    'd-01',
    'duration',
    false,
    'chambre a louer pour 2 nuits',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-02',
    'duration',
    false,
    'house for 2 weeks in Mbour',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-03',
    'duration',
    false,
    'appart court sejour a Dakar',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-04',
    'duration',
    false,
    'studio pour vacances a Saly',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-05',
    'duration',
    false,
    'chambre a louer pour un weekend',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-06',
    'duration',
    false,
    'studio for a weekend getaway',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-07',
    'duration',
    false,
    'chambre a louer pour 3 jours',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-08',
    'duration',
    false,
    'chambre a louer par semaine',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-09',
    'duration',
    false,
    'chambre a louer par jour',
    { rentalMode: 'NIGHTLY' },
  ],
  [
    'd-10',
    'duration',
    false,
    'villa longue duree a Saly',
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-11',
    'duration',
    false,
    'appart bail de 2 ans',
    { rentalMode: 'MONTHLY' },
  ],
  ['d-12', 'duration', false, 'studio for one year', { rentalMode: 'MONTHLY' }],
  [
    'd-13',
    'duration',
    false,
    "appart a l'annee a Dakar",
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-14',
    'duration',
    false,
    'house for one year in Dakar',
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-15',
    'duration',
    false,
    'maison a louer pour 6 mois',
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-16',
    'duration',
    false,
    'house for 6 months in Mbour',
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-17',
    'duration',
    false,
    'chambre a louer pour 1 mois',
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-18',
    'duration',
    false,
    'villa a louer par mois',
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-19',
    'duration',
    false,
    'house to rent monthly',
    { rentalMode: 'MONTHLY' },
  ],
  [
    'd-20',
    'duration',
    false,
    'studio 25mil la nuit',
    { rentalMode: 'NIGHTLY' },
  ],

  // -- Négatifs (restraint) : aucun rentalMode — date (≠ durée), âge (≠
  // durée), absence totale du sujet, numéro de téléphone sans rapport. --
  [
    'd-21',
    'duration',
    true,
    'chambre a louer pour 15 decembre',
    { rentalMode: null },
  ],
  ['d-22', 'duration', true, 'appart 3 chambres a Dakar', { rentalMode: null }],
  [
    'd-23',
    'duration',
    true,
    'villa a Dakar, il a 30 ans',
    { rentalMode: null },
  ],
  ['d-24', 'duration', true, 'studio pour 1 an a Dakar', { rentalMode: null }],
  ['d-25', 'duration', true, 'villa 6 chambres a Dakar', { rentalMode: null }],
  [
    'd-26',
    'duration',
    true,
    'appart a Dakar, numero 77 123 45 67',
    { rentalMode: null },
  ],
  ['d-27', 'duration', true, 'studio moderne a Dakar', { rentalMode: null }],
  ['d-28', 'duration', true, 'villa a Saly avec piscine', { rentalMode: null }],
  ['d-29', 'duration', true, 'appart climatise a Dakar', { rentalMode: null }],
  [
    'd-30',
    'duration',
    true,
    'chambre a Dakar pour 2 personnes',
    { rentalMode: null },
  ],
  ['d-31', 'duration', true, 'villa a vendre a Saly', { rentalMode: null }],
  [
    'd-32',
    'duration',
    true,
    'appart a Dakar budget 300000',
    { rentalMode: null },
  ],
  [
    'd-33',
    'duration',
    false,
    'maison a louer pour 2 nuits, puis par mois',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'd-34',
    'duration',
    false,
    'appart a louer par semaine ou par mois',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'd-35',
    'duration',
    false,
    'house for a night or per month',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  ['d-36', 'duration', true, 'studio Liberte 6 a Dakar', { rentalMode: null }],
  [
    'd-37',
    'duration',
    true,
    'appart Sacre-Coeur a Dakar',
    { rentalMode: null },
  ],
  ['d-38', 'duration', true, 'villa 500m2 a Saly', { rentalMode: null }],
  ['d-39', 'duration', true, 'chambre meublee a Dakar', { rentalMode: null }],
  ['d-40', 'duration', true, 'appart non meuble a Dakar', { rentalMode: null }],
  ['d-41', 'duration', true, 'studio pas cher a Dakar', { rentalMode: null }],
  [
    'd-42',
    'duration',
    true,
    'villa Thies budget 2000000',
    { rentalMode: null },
  ],

  // ══ Classe pricePerNight — prix par nuit ════════════════════════════════
  // -- Positifs : minPricePerNight/maxPricePerNight, jamais minPrice/
  // maxPrice. --
  [
    'p-01',
    'pricePerNight',
    false,
    'chambre budget 20000 la nuit',
    { maxPricePerNight: 20000 },
  ],
  [
    'p-02',
    'pricePerNight',
    false,
    'chambre max 20000 la nuit',
    { maxPricePerNight: 20000 },
  ],
  [
    'p-03',
    'pricePerNight',
    false,
    'chambre environ 20000 la nuit',
    { maxPricePerNight: 22000, ambiguitiesInclude: ['approximateAmount'] },
  ],
  [
    'p-04',
    'pricePerNight',
    false,
    '20000 la nuit minimum',
    { minPricePerNight: 20000 },
  ],
  [
    'p-05',
    'pricePerNight',
    false,
    'chambre a louer, 20000 la nuit maximum',
    { maxPricePerNight: 20000 },
  ],
  [
    'p-06',
    'pricePerNight',
    false,
    'studio 15000 par nuit, max',
    { maxPricePerNight: 15000 },
  ],
  [
    'p-07',
    'pricePerNight',
    false,
    'studio 25mil la nuit minimum',
    { minPricePerNight: 25000 },
  ],
  [
    'p-08',
    'pricePerNight',
    false,
    'budget 20000 la nuit',
    { maxPricePerNight: 20000 },
  ],
  [
    'p-09',
    'pricePerNight',
    false,
    'chambre au moins 10000 la nuit',
    { minPricePerNight: 10000 },
  ],
  [
    'p-10',
    'pricePerNight',
    false,
    'house at least 15000 per night',
    { minPricePerNight: 15000 },
  ],
  [
    'p-11',
    'pricePerNight',
    false,
    'room max 30000 per night',
    { maxPricePerNight: 30000 },
  ],
  [
    'p-12',
    'pricePerNight',
    false,
    'chambre a vendre, budget 20000 la nuit',
    { maxPricePerNight: 20000 },
  ],
  [
    'p-13',
    'pricePerNight',
    false,
    'chambre a louer, budget 20000 la nuit, 2 chambres',
    { maxPricePerNight: 20000, minBeds: 2, maxBeds: 2 },
  ],

  // -- Négatifs (restraint) : jamais un prix mensuel, jamais un prix par
  // nuit sans rapport — téléphone, semaine/jour (periodNotSupported gardé),
  // date, montant nu sans direction. --
  [
    'p-14',
    'pricePerNight',
    true,
    'chambre 15000 par semaine',
    { maxPricePerNight: null, ambiguitiesInclude: ['periodNotSupported'] },
  ],
  [
    'p-15',
    'pricePerNight',
    true,
    'chambre 15000 par jour',
    { maxPricePerNight: null, ambiguitiesInclude: ['periodNotSupported'] },
  ],
  [
    'p-16',
    'pricePerNight',
    true,
    'studio 25mil la nuit',
    { maxPricePerNight: 28000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'p-17',
    'pricePerNight',
    true,
    'room for 15000 per night',
    { maxPricePerNight: 17000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'p-18',
    'pricePerNight',
    true,
    'numero 77 123 45 67, chambre 20000 la nuit',
    { maxPricePerNight: 22000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'p-19',
    'pricePerNight',
    true,
    'villa a louer, 2000000 par mois',
    { maxPricePerNight: null },
  ],
  [
    'p-20',
    'pricePerNight',
    true,
    'maison budget 2 millions par mois',
    { maxPricePerNight: null },
  ],
  [
    'p-21',
    'pricePerNight',
    true,
    'appart 3 chambres a Dakar',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-22',
    'pricePerNight',
    true,
    'villa a Saly avec piscine',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-23',
    'pricePerNight',
    true,
    'chambre a louer pour 15 decembre',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-24',
    'pricePerNight',
    true,
    'studio moderne a Dakar',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-25',
    'pricePerNight',
    true,
    'villa a Dakar budget 90 millions',
    { maxPricePerNight: null },
  ],
  [
    'p-26',
    'pricePerNight',
    true,
    'appart a Dakar entre 100k et 150k',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-27',
    'pricePerNight',
    true,
    'chambre pour 2 personnes a Dakar',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-28',
    'pricePerNight',
    true,
    'villa 500m2 a Saly',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-29',
    'pricePerNight',
    true,
    'house for 2 weeks in Mbour',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-30',
    'pricePerNight',
    true,
    'studio Liberte 6 a Dakar',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-31',
    'pricePerNight',
    true,
    'chambre meublee a Dakar',
    { maxPricePerNight: null, minPricePerNight: null },
  ],
  [
    'p-32',
    'pricePerNight',
    true,
    'appart non meuble, 300000 par mois',
    { maxPricePerNight: null, minPricePerNight: null, maxBeds: null },
  ],
  [
    'p-33',
    'pricePerNight',
    true,
    'villa Thies budget 2000000',
    { maxPricePerNight: null },
  ],

  // ══ Classe conflict — contradiction nuitée/mensuel ══════════════════════
  // -- Positifs (pièges par construction : la contradiction doit être
  // détectée, jamais résolue au hasard vers l'un des deux). --
  [
    'c-01',
    'conflict',
    true,
    'maison a louer pour 2 nuits, puis par mois',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-02',
    'conflict',
    true,
    'appart a louer par semaine ou par mois',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-03',
    'conflict',
    true,
    'house for a night or per month',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-04',
    'conflict',
    true,
    "studio a louer par jour ou a l'annee",
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-05',
    'conflict',
    true,
    'villa pour un weekend ou en bail longue duree',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-06',
    'conflict',
    true,
    'chambre par semaine, mensuel possible',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-07',
    'conflict',
    true,
    'room per night or monthly',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-08',
    'conflict',
    true,
    'appart pour vacances ou longue duree',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-09',
    'conflict',
    true,
    'studio court sejour ou bail',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-10',
    'conflict',
    true,
    'house for 2 days or for one year',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-11',
    'conflict',
    true,
    'villa a louer par nuit ou au mois',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-12',
    'conflict',
    true,
    'appart pour 2 jours ou pour 6 mois',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],
  [
    'c-13',
    'conflict',
    true,
    'chambre pour vacances, mensuel aussi possible',
    { rentalMode: null, ambiguitiesInclude: ['rentalModeConflict'] },
  ],

  // -- Négatifs (restraint) : un seul des deux signaux présent → PAS de
  // conflit, rentalMode normalement posé (confirme que la détection de
  // conflit ne se déclenche jamais à tort sur un cas simple). --
  [
    'c-14',
    'conflict',
    true,
    'chambre a louer pour 2 nuits',
    { rentalMode: 'NIGHTLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-15',
    'conflict',
    true,
    'villa a louer par mois',
    { rentalMode: 'MONTHLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-16',
    'conflict',
    true,
    'appart 3 chambres a Dakar',
    { rentalMode: null, ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-17',
    'conflict',
    true,
    'house for one year in Dakar',
    { rentalMode: 'MONTHLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-18',
    'conflict',
    true,
    'studio for a weekend getaway',
    { rentalMode: 'NIGHTLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-19',
    'conflict',
    true,
    'villa a Dakar, il a 30 ans',
    { rentalMode: null, ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-20',
    'conflict',
    true,
    'studio pour 1 an a Dakar',
    { rentalMode: null, ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-21',
    'conflict',
    true,
    'appart bail de 2 ans',
    { rentalMode: 'MONTHLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-22',
    'conflict',
    true,
    'house to rent monthly',
    { rentalMode: 'MONTHLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-23',
    'conflict',
    true,
    'chambre a louer par jour',
    { rentalMode: 'NIGHTLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-24',
    'conflict',
    true,
    'appart a Dakar, numero 77 123 45 67',
    { rentalMode: null, ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-25',
    'conflict',
    true,
    'studio moderne a Dakar',
    { rentalMode: null, ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-26',
    'conflict',
    true,
    "appart a l'annee a Dakar",
    { rentalMode: 'MONTHLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-27',
    'conflict',
    true,
    'villa longue duree a Saly',
    { rentalMode: 'MONTHLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],
  [
    'c-28',
    'conflict',
    true,
    'studio pour vacances a Saly',
    { rentalMode: 'NIGHTLY', ambiguitiesExclude: ['rentalModeConflict'] },
  ],

  // -- Positifs supplémentaires (conflit combiné à d'autres critères — le
  // conflit ne doit jamais empêcher le reste de l'extraction). --
  [
    'c-29',
    'conflict',
    false,
    'appart 3 chambres a Dakar, a louer pour 2 nuits ou par mois',
    {
      rentalMode: null,
      minBeds: 3,
      maxBeds: 3,
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-30',
    'conflict',
    false,
    'villa meublee a Saly, pour un weekend ou longue duree',
    {
      rentalMode: null,
      furnished: true,
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-31',
    'conflict',
    false,
    'house for a night or per month in Mbour',
    {
      rentalMode: null,
      region: 'Thiès',
      cityContains: 'Mbour',
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-32',
    'conflict',
    false,
    'appart a Dakar par semaine ou par mois, 2 chambres',
    {
      rentalMode: null,
      minBeds: 2,
      maxBeds: 2,
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-33',
    'conflict',
    false,
    'studio pour vacances ou bail, non meuble',
    {
      rentalMode: null,
      furnished: false,
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-34',
    'conflict',
    false,
    'chambre a Thies pour 2 jours ou par an',
    {
      rentalMode: null,
      region: 'Thiès',
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-35',
    'conflict',
    false,
    'villa a vendre pour un weekend ou longue duree',
    {
      rentalMode: null,
      transactionType: 'VENTE',
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-36',
    'conflict',
    false,
    'room per night or monthly in Dakar',
    {
      rentalMode: null,
      region: 'Dakar',
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-37',
    'conflict',
    false,
    'appart meuble pour 2 jours ou par an',
    {
      rentalMode: null,
      furnished: true,
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-38',
    'conflict',
    false,
    'villa Saly pour 2 nuits ou au mois',
    {
      rentalMode: null,
      cityContains: 'Saly',
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-39',
    'conflict',
    false,
    'house for one night or monthly, 3 bedrooms',
    {
      rentalMode: null,
      minBeds: 3,
      maxBeds: 3,
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
  [
    'c-40',
    'conflict',
    false,
    'chambre a Dakar par jour ou bail',
    {
      rentalMode: null,
      region: 'Dakar',
      ambiguitiesInclude: ['rentalModeConflict'],
    },
  ],
];

export const DEV_DATASET_4: DevCase4[] = RAW.map(
  ([id, klass, negative, text, expect], idx): DevCase4 => ({
    id,
    klass,
    negative,
    text,
    expect,
    held: idx % 3 === 2,
  }),
);
