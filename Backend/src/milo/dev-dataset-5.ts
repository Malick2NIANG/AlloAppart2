/**
 * Milo Search v0 — fix « prix nu par nuit en budget cible ». Un montant nu
 * suivi d'un mot-clé nuitée (la nuit/par nuit/per night/a night/ /nuit),
 * SANS mot-clé de direction (budget/max/min) : l'adjacence au mot-clé
 * nuitée est elle-même un contexte de budget suffisant (même principe que
 * `monthlyPeriodKeywords` pour le montant nu mensuel, règle G) — jamais
 * besoin de `transactionType` en plus. Avant ce fix, ces cas tombaient à
 * tort en ambiguïté `amountDirection` sans aucun prix posé.
 *
 * `negative: true` couvre deux choses distinctes ici : (a) les cas où
 * l'ANCIEN comportement échouait (pas de transactionType, pas
 * d'approximatif) — pièges qui valident que le fix est bien appliqué ; et
 * (b) les cas de portée (le fix ne doit JAMAIS s'appliquer à un montant
 * avec direction propre, à un montant non-nuitée, ou à un mot-clé nuitée
 * sans montant) — pièges qui valident que le fix reste bien scopé.
 *
 * Aucune phrase copiée de requetes*.json. `held` : idx % 3 === 2.
 */
import type { MiloAmbiguity } from './types';

export interface DevCase5Expect {
  maxPricePerNight?: number | null;
  maxPrice?: number | null;
  ambiguitiesInclude?: MiloAmbiguity[];
  ambiguitiesExclude?: MiloAmbiguity[];
}

export interface DevCase5 {
  id: string;
  negative: boolean;
  text: string;
  expect: DevCase5Expect;
  held: boolean;
}

type Raw = [string, boolean, string, DevCase5Expect];

const RAW: Raw[] = [
  // ── Le fix s'applique (pas de transactionType, pas d'approximatif) ──────
  [
    'n-01',
    true,
    'studio 15000 la nuit',
    { maxPricePerNight: 17000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-02',
    true,
    'chambre 20000 par nuit',
    { maxPricePerNight: 22000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-03',
    true,
    'villa 50000 la nuit a Saly',
    { maxPricePerNight: 55000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-04',
    true,
    'appart 30000 /nuit',
    { maxPricePerNight: 33000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-05',
    true,
    'room 15000 per night',
    { maxPricePerNight: 17000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-06',
    true,
    'house 25000 a night',
    { maxPricePerNight: 28000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-07',
    true,
    'studio meuble 18000 la nuit',
    { maxPricePerNight: 20000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-08',
    true,
    'chambre 10000 la nuit a Thies',
    { maxPricePerNight: 11000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-09',
    true,
    '25000 la nuit, chambre a Dakar',
    { maxPricePerNight: 28000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-10',
    true,
    'numero 70 111 22 33, villa 60000 la nuit',
    { maxPricePerNight: 66000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-11',
    true,
    'studio 12000 /nuit a Mbour',
    { maxPricePerNight: 13000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-12',
    true,
    'chambre 90000 la nuit a Dakar, 3 chambres',
    { maxPricePerNight: 99000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-13',
    true,
    'numero 781234567, chambre 20000 la nuit',
    { maxPricePerNight: 22000, ambiguitiesInclude: ['targetAmount'] },
  ],

  // ── Déjà correct avant le fix (transactionType posé) — non-régression ──
  [
    'n-14',
    false,
    'appart a louer 40000 la nuit',
    { maxPricePerNight: 44000, ambiguitiesInclude: ['targetAmount'] },
  ],
  [
    'n-15',
    false,
    'chambre a vendre 20000 la nuit',
    { maxPricePerNight: 22000, ambiguitiesInclude: ['targetAmount'] },
  ],

  // ── Approximatif (déjà correct avant le fix) — non-régression ───────────
  [
    'n-16',
    false,
    'chambre environ 20000 la nuit',
    {
      maxPricePerNight: 22000,
      ambiguitiesInclude: ['approximateAmount'],
      ambiguitiesExclude: ['targetAmount'],
    },
  ],
  [
    'n-17',
    false,
    'studio autour de 15000 la nuit',
    {
      maxPricePerNight: 17000,
      ambiguitiesInclude: ['approximateAmount'],
      ambiguitiesExclude: ['targetAmount'],
    },
  ],
  [
    'n-18',
    false,
    'studio around 15000 per night',
    {
      maxPricePerNight: 17000,
      ambiguitiesInclude: ['approximateAmount'],
      ambiguitiesExclude: ['targetAmount'],
    },
  ],
  [
    'n-19',
    false,
    'appart environ 20000 par nuit',
    {
      maxPricePerNight: 22000,
      ambiguitiesInclude: ['approximateAmount'],
      ambiguitiesExclude: ['targetAmount'],
    },
  ],
  [
    'n-20',
    false,
    'house about 15000 a night',
    {
      maxPricePerNight: 17000,
      ambiguitiesInclude: ['approximateAmount'],
      ambiguitiesExclude: ['targetAmount'],
    },
  ],

  // ── Portée : le fix ne doit JAMAIS s'appliquer ailleurs ─────────────────
  // Direction propre déjà présente : résolution par direction, jamais de
  // targetAmount en plus (le fix ne doit pas se superposer).
  [
    'n-21',
    true,
    'chambre budget 20000 la nuit',
    { maxPricePerNight: 20000, ambiguitiesExclude: ['targetAmount'] },
  ],
  [
    'n-22',
    true,
    'chambre a louer, 20000 la nuit maximum',
    { maxPricePerNight: 20000, ambiguitiesExclude: ['targetAmount'] },
  ],
  // Montant nu SANS mot-clé nuitée : comportement général inchangé
  // (amountDirection, aucun prix), jamais réinterprété en budget cible.
  [
    'n-23',
    true,
    'villa a Saly 80 millions',
    {
      maxPrice: null,
      maxPricePerNight: null,
      ambiguitiesInclude: ['amountDirection'],
      ambiguitiesExclude: ['targetAmount'],
    },
  ],
  // Période non-nuitée (semaine/jour) : toujours periodNotSupported, jamais
  // récupéré par le fix nuitée.
  [
    'n-24',
    true,
    'chambre 15000 par semaine',
    {
      maxPricePerNight: null,
      ambiguitiesInclude: ['periodNotSupported'],
      ambiguitiesExclude: ['targetAmount'],
    },
  ],
  // Mot-clé nuitée seul, sans aucun montant adjacent : rien à réclamer,
  // jamais de prix fabriqué.
  [
    'n-25',
    true,
    'chambre a louer pour la nuit',
    { maxPricePerNight: null, ambiguitiesExclude: ['targetAmount'] },
  ],
  // Montant nu mensuel : classe séparée (maxPrice, pas maxPricePerNight),
  // déjà correcte avant ce fix — non-régression de règle G.
  [
    'n-26',
    true,
    'chambre 300000 par mois',
    {
      maxPrice: 330000,
      maxPricePerNight: null,
      ambiguitiesInclude: ['targetAmount'],
    },
  ],
];

export const DEV_DATASET_5: DevCase5[] = RAW.map(
  ([id, negative, text, expect], idx): DevCase5 => ({
    id,
    negative,
    text,
    expect,
    held: idx % 3 === 2,
  }),
);
