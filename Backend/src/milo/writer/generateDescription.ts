import type { WriterInput } from './types';
import { pickVariant } from './hash';
import {
  AMENITY_LABEL_EN,
  AMENITY_LABEL_FR,
  AMENITY_ORDER,
  TYPE_DEM_FR,
  TYPE_LABEL_EN,
  TYPE_LABEL_FR,
  TYPE_PRONOUN_FR,
  capitalize,
  formatAmount,
  formatAmountEn,
  joinList,
  proseAmenityLabel,
} from './dictionaries/labels';

/** Types pour lesquels « Il dispose de 1 salle de bain » sonne faux (pas de vie résidentielle) — intitulé neutre à la place. */
const SANITARY_HEADING_TYPES = ['BUREAU', 'LOCAL_COMMERCIAL'];

/**
 * Libellé d'équipement propre au contexte terrain — sous l'intitulé
 * « Caractéristiques du terrain », répéter « terrain »/« plot » dans
 * l'équipement lui-même est redondant (« terrain viabilisé » → « viabilisé »).
 */
const TERRAIN_AMENITY_LABEL_FR: Record<string, string> = {
  viabilise: 'viabilisé',
};
const TERRAIN_AMENITY_LABEL_EN: Record<string, string> = {
  viabilise: 'serviced',
};

/** Clé stable qui identifie la combinaison de champs — sert de graine au choix de variante. */
function seedOf(input: WriterInput): string {
  return JSON.stringify(input, Object.keys(input).sort());
}

function pick(input: WriterInput, salt: string, variants: string[]): string {
  return variants[pickVariant(seedOf(input), salt, variants.length)];
}

function pluralFr(
  n: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return n === 1 ? singular : pluralForm;
}

function pluralEn(
  n: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return n === 1 ? singular : pluralForm;
}

/* ───────────────────────── FR ───────────────────────── */

function locationPhraseFr(input: WriterInput): string {
  if (input.transactionType === 'VENTE') return 'à vendre';
  switch (input.rentalMode) {
    case 'NIGHTLY':
      return 'à louer à la nuitée';
    case 'MIXED':
      return 'à louer à la nuitée ou au mois';
    case 'MONTHLY':
    default:
      return 'à louer';
  }
}

function placePhraseFr(input: WriterInput): string {
  if (input.city) return ` à ${input.city}`;
  if (input.region) return ` dans la région de ${input.region}`;
  return '';
}

function openingFr(input: WriterInput): string {
  const typeLabel = TYPE_LABEL_FR[input.type];
  const dem = TYPE_DEM_FR[input.type];
  const loc = locationPhraseFr(input);
  const place = placePhraseFr(input);
  const variants = [
    `${capitalize(dem)} ${typeLabel} est ${loc}${place}.`,
    `Découvrez ${dem} ${typeLabel}${place}, ${loc}.`,
    `${capitalize(typeLabel)} ${loc}${place}.`,
  ];
  return pick(input, 'opening', variants);
}

function characteristicsFr(input: WriterInput): string | null {
  const fragments: string[] = [];
  if (input.surface !== undefined)
    fragments.push(`${formatAmount(input.surface)} m²`);
  if (input.rooms !== undefined)
    fragments.push(`${input.rooms} ${pluralFr(input.rooms, 'pièce')}`);
  // Type CHAMBRE : le nombre de chambres est redondant avec le type lui-même
  // (une annonce de type « chambre » n'a pas de sous-chambres à compter).
  if (input.beds !== undefined && input.type !== 'CHAMBRE')
    fragments.push(`${input.beds} ${pluralFr(input.beds, 'chambre')}`);
  const bathsFragment =
    input.baths !== undefined
      ? `${input.baths} ${pluralFr(input.baths, 'salle', 'salles')} de bain`
      : undefined;
  if (bathsFragment !== undefined) fragments.push(bathsFragment);
  if (fragments.length === 0) return null;

  // Bureau/local commercial, seule caractéristique = la salle de bain :
  // éviter « Il dispose de 1 salle de bain », trop résidentiel pour ces types.
  if (
    fragments.length === 1 &&
    bathsFragment !== undefined &&
    SANITARY_HEADING_TYPES.includes(input.type)
  ) {
    return `Sanitaires : ${bathsFragment}.`;
  }

  const joined = joinList(fragments, 'et');
  const pronoun = TYPE_PRONOUN_FR[input.type];
  const variants = [
    `${capitalize(pronoun)} dispose de ${joined}.`,
    `Caractéristiques : ${joined}.`,
    `Détails : ${joined}.`,
  ];
  return pick(input, 'characteristics', variants);
}

function furnishedFr(input: WriterInput): string | null {
  if (input.furnished === undefined) return null;
  // Accord en genre : « il »/« elle » + l'adjectif « meublé »/« meublée ».
  // Jamais de phrase isolée non accordée (« Meublé. » seul) — toujours une
  // vraie phrase, avec un nom neutre (« logement »/« bien », masculins) ou
  // le pronom accordé au type.
  const pronoun = TYPE_PRONOUN_FR[input.type];
  const fem = pronoun === 'elle';
  const agr = fem ? 'e' : '';
  const variants = input.furnished
    ? [
        'Le logement est meublé.',
        `${capitalize(pronoun)} est meublé${agr}.`,
        'Le bien est meublé.',
      ]
    : [
        'Le logement est non meublé.',
        `${capitalize(pronoun)} est non meublé${agr}.`,
        'Le bien est non meublé.',
      ];
  return pick(input, 'furnished', variants);
}

function amenitiesFr(input: WriterInput): string | null {
  const selected = AMENITY_ORDER.filter((k) =>
    (input.amenities ?? []).includes(k),
  );
  if (selected.length === 0) return null;
  const isTerrain = input.type === 'TERRAIN';
  const labels = selected.map((k) =>
    proseAmenityLabel(
      isTerrain && TERRAIN_AMENITY_LABEL_FR[k]
        ? TERRAIN_AMENITY_LABEL_FR[k]
        : AMENITY_LABEL_FR[k],
    ),
  );
  const joined = joinList(labels, 'et');
  // Terrain : un seul intitulé partout (jamais « dispose de »/« profitez
  // de »). Autres types : jamais de verbe « dispose » — déjà utilisé par la
  // phrase de caractéristiques juste avant, ça produirait une répétition
  // (« Elle dispose… Elle dispose de : »).
  if (isTerrain) return `Caractéristiques du terrain : ${joined}.`;
  const variants = [
    `Équipements : ${joined}.`,
    `Équipements disponibles : ${joined}.`,
  ];
  return pick(input, 'amenities', variants);
}

function pricingFr(input: WriterInput): string[] {
  const out: string[] = [];
  const isVente = input.transactionType === 'VENTE';

  if (isVente) {
    if (input.price !== undefined) {
      out.push(
        pick(input, 'price-vente', [
          `Prix de vente : ${formatAmount(input.price)} FCFA.`,
          `Ce bien est proposé à la vente pour ${formatAmount(input.price)} FCFA.`,
          `Montant demandé : ${formatAmount(input.price)} FCFA.`,
        ]),
      );
    }
    return out;
  }

  const mode = input.rentalMode;
  const hasMonthly =
    mode === 'MONTHLY' || (mode === 'MIXED' && input.price !== undefined);
  const hasNightly =
    mode === 'NIGHTLY' ||
    (mode === 'MIXED' && input.pricePerNight !== undefined);

  if (
    mode === 'MIXED' &&
    input.price !== undefined &&
    input.pricePerNight !== undefined
  ) {
    out.push(
      pick(input, 'price-mixed', [
        `Disponible à la nuitée (${formatAmount(input.pricePerNight)} FCFA/nuit) ou au mois (${formatAmount(input.price)} FCFA/mois).`,
        `Formule flexible : ${formatAmount(input.pricePerNight)} FCFA la nuit, ou ${formatAmount(input.price)} FCFA pour un mois.`,
        `Deux formules possibles : nuitée à ${formatAmount(input.pricePerNight)} FCFA, ou location mensuelle à ${formatAmount(input.price)} FCFA.`,
      ]),
    );
  } else {
    if (hasMonthly && input.price !== undefined) {
      out.push(
        pick(input, 'price-monthly', [
          `Loyer mensuel : ${formatAmount(input.price)} FCFA.`,
          `Ce bien se loue ${formatAmount(input.price)} FCFA par mois.`,
          `Tarif mensuel : ${formatAmount(input.price)} FCFA.`,
        ]),
      );
    }
    if (hasNightly && input.pricePerNight !== undefined) {
      out.push(
        pick(input, 'price-nightly', [
          `Tarif : ${formatAmount(input.pricePerNight)} FCFA par nuit.`,
          `Ce bien se loue ${formatAmount(input.pricePerNight)} FCFA la nuit.`,
          `Prix par nuit : ${formatAmount(input.pricePerNight)} FCFA.`,
        ]),
      );
    }
  }

  // Reprend fidèlement le champ, quel que soit le mode — jamais de règle de
  // tarif déduite. En mode MIXED, un tarif nuitée existe aussi : la durée
  // minimale doit être rattachée explicitement à la formule MENSUELLE
  // (jamais présentée comme une condition générale qui s'appliquerait aussi
  // à la nuitée).
  if (input.minLeaseMonths !== undefined) {
    out.push(
      mode === 'MIXED'
        ? pick(input, 'min-lease-mixed', [
            `Formule mensuelle : engagement minimum de ${input.minLeaseMonths} mois.`,
            `Pour la formule mensuelle, engagement minimum de ${input.minLeaseMonths} mois.`,
            `La formule mensuelle demande un engagement minimum de ${input.minLeaseMonths} mois.`,
          ])
        : pick(input, 'min-lease', [
            `Durée minimale : ${input.minLeaseMonths} mois.`,
            `Durée minimale de bail : ${input.minLeaseMonths} mois.`,
            `Engagement minimum : ${input.minLeaseMonths} mois.`,
          ]),
    );
  }

  if (input.depositMonths !== undefined) {
    out.push(
      pick(input, 'deposit', [
        `Caution demandée : ${input.depositMonths} ${pluralFr(input.depositMonths, 'mois', 'mois')} de loyer.`,
        `Une caution de ${input.depositMonths} ${pluralFr(input.depositMonths, 'mois', 'mois')} de loyer est demandée.`,
        `Dépôt de garantie : ${input.depositMonths} ${pluralFr(input.depositMonths, 'mois', 'mois')} de loyer.`,
      ]),
    );
  }

  if (input.chargesIncluded !== undefined) {
    out.push(
      pick(
        input,
        'charges',
        input.chargesIncluded
          ? [
              'Charges comprises.',
              'Les charges locatives sont incluses dans le loyer.',
              'Charges incluses dans le loyer.',
            ]
          : [
              'Charges non comprises.',
              'Les charges locatives ne sont pas incluses dans le loyer.',
              'Charges en sus du loyer.',
            ],
      ),
    );
  }

  if (input.minimumNights !== undefined) {
    out.push(
      pick(input, 'min-nights', [
        `Séjour minimum : ${input.minimumNights} ${pluralFr(input.minimumNights, 'nuit')}.`,
        `Durée de séjour minimale : ${input.minimumNights} ${pluralFr(input.minimumNights, 'nuit')}.`,
        `${input.minimumNights} ${pluralFr(input.minimumNights, 'nuit')} minimum par séjour.`,
      ]),
    );
  }

  if (input.maximumNights !== undefined) {
    out.push(
      pick(input, 'max-nights', [
        `Séjour maximum : ${input.maximumNights} ${pluralFr(input.maximumNights, 'nuit')}.`,
        `Durée de séjour maximale : ${input.maximumNights} ${pluralFr(input.maximumNights, 'nuit')}.`,
        `${input.maximumNights} ${pluralFr(input.maximumNights, 'nuit')} maximum par séjour.`,
      ]),
    );
  }

  if (input.cleaningFee !== undefined) {
    out.push(
      pick(input, 'cleaning-fee', [
        `Frais de ménage : ${formatAmount(input.cleaningFee)} FCFA.`,
        `Des frais de ménage de ${formatAmount(input.cleaningFee)} FCFA s'appliquent.`,
        `Supplément ménage : ${formatAmount(input.cleaningFee)} FCFA.`,
      ]),
    );
  }

  return out;
}

/* ───────────────────────── EN ───────────────────────── */

function locationPhraseEn(input: WriterInput): string {
  if (input.transactionType === 'VENTE') return 'for sale';
  switch (input.rentalMode) {
    case 'NIGHTLY':
      return 'available for nightly rental';
    case 'MIXED':
      return 'available for nightly or monthly rental';
    case 'MONTHLY':
    default:
      return 'available for rent';
  }
}

function placePhraseEn(input: WriterInput): string {
  if (input.city) return ` in ${input.city}`;
  if (input.region) return ` in the ${input.region} region`;
  return '';
}

function openingEn(input: WriterInput): string {
  const typeLabel = TYPE_LABEL_EN[input.type];
  const loc = locationPhraseEn(input);
  const place = placePhraseEn(input);
  const variants = [
    `This ${typeLabel} is ${loc}${place}.`,
    `Discover this ${typeLabel}${place}, ${loc}.`,
    `${capitalize(typeLabel)} ${loc}${place}.`,
  ];
  return pick(input, 'opening', variants);
}

function characteristicsEn(input: WriterInput): string | null {
  const fragments: string[] = [];
  if (input.surface !== undefined)
    fragments.push(`${formatAmountEn(input.surface)} m²`);
  if (input.rooms !== undefined)
    fragments.push(`${input.rooms} ${pluralEn(input.rooms, 'room')}`);
  // Type CHAMBRE : the bedroom count is redundant with the type itself.
  if (input.beds !== undefined && input.type !== 'CHAMBRE')
    fragments.push(`${input.beds} ${pluralEn(input.beds, 'bedroom')}`);
  const bathsFragment =
    input.baths !== undefined
      ? `${input.baths} ${pluralEn(input.baths, 'bathroom')}`
      : undefined;
  if (bathsFragment !== undefined) fragments.push(bathsFragment);
  if (fragments.length === 0) return null;

  if (
    fragments.length === 1 &&
    bathsFragment !== undefined &&
    SANITARY_HEADING_TYPES.includes(input.type)
  ) {
    return `Facilities: ${bathsFragment}.`;
  }

  const joined = joinList(fragments, 'and');
  const variants = [
    `It offers ${joined}.`,
    `Key features: ${joined}.`,
    `Details: ${joined}.`,
  ];
  return pick(input, 'characteristics', variants);
}

function furnishedEn(input: WriterInput): string | null {
  if (input.furnished === undefined) return null;
  const variants = input.furnished
    ? ['The property is furnished.', 'It is furnished.', 'Furnished.']
    : ['The property is unfurnished.', 'It is unfurnished.', 'Unfurnished.'];
  return pick(input, 'furnished', variants);
}

function amenitiesEn(input: WriterInput): string | null {
  const selected = AMENITY_ORDER.filter((k) =>
    (input.amenities ?? []).includes(k),
  );
  if (selected.length === 0) return null;
  const isTerrain = input.type === 'TERRAIN';
  const labels = selected.map((k) =>
    proseAmenityLabel(
      isTerrain && TERRAIN_AMENITY_LABEL_EN[k]
        ? TERRAIN_AMENITY_LABEL_EN[k]
        : AMENITY_LABEL_EN[k],
    ),
  );
  const joined = joinList(labels, 'and');
  // Plot: single heading everywhere (never "offers"/"enjoy"). Other types:
  // never the verb "offers" — already used by the characteristics sentence
  // just before, which would read as a repetition ("It offers… It offers:").
  if (isTerrain) return `Plot features: ${joined}.`;
  const variants = [`Amenities: ${joined}.`, `Available amenities: ${joined}.`];
  return pick(input, 'amenities', variants);
}

function pricingEn(input: WriterInput): string[] {
  const out: string[] = [];
  const isVente = input.transactionType === 'VENTE';

  if (isVente) {
    if (input.price !== undefined) {
      out.push(
        pick(input, 'price-vente', [
          `Sale price: ${formatAmountEn(input.price)} FCFA.`,
          `This property is listed for sale at ${formatAmountEn(input.price)} FCFA.`,
          `Asking price: ${formatAmountEn(input.price)} FCFA.`,
        ]),
      );
    }
    return out;
  }

  const mode = input.rentalMode;

  if (
    mode === 'MIXED' &&
    input.price !== undefined &&
    input.pricePerNight !== undefined
  ) {
    out.push(
      pick(input, 'price-mixed', [
        `Available nightly (${formatAmountEn(input.pricePerNight)} FCFA/night) or monthly (${formatAmountEn(input.price)} FCFA/month).`,
        `Flexible option: ${formatAmountEn(input.pricePerNight)} FCFA per night, or ${formatAmountEn(input.price)} FCFA for a month.`,
        `Two options available: nightly at ${formatAmountEn(input.pricePerNight)} FCFA, or monthly rental at ${formatAmountEn(input.price)} FCFA.`,
      ]),
    );
  } else {
    if ((mode === 'MONTHLY' || mode === 'MIXED') && input.price !== undefined) {
      out.push(
        pick(input, 'price-monthly', [
          `Monthly rent: ${formatAmountEn(input.price)} FCFA.`,
          `This property rents for ${formatAmountEn(input.price)} FCFA per month.`,
          `Monthly rate: ${formatAmountEn(input.price)} FCFA.`,
        ]),
      );
    }
    if (
      (mode === 'NIGHTLY' || mode === 'MIXED') &&
      input.pricePerNight !== undefined
    ) {
      out.push(
        pick(input, 'price-nightly', [
          `Rate: ${formatAmountEn(input.pricePerNight)} FCFA per night.`,
          `This property rents for ${formatAmountEn(input.pricePerNight)} FCFA per night.`,
          `Nightly rate: ${formatAmountEn(input.pricePerNight)} FCFA.`,
        ]),
      );
    }
  }

  // Reprend fidèlement le champ, quel que soit le mode — jamais de règle de
  // tarif déduite. En mode MIXED, rattache explicitement la durée au plan
  // MENSUEL (jamais une condition générale qui s'appliquerait aussi à la nuitée).
  if (input.minLeaseMonths !== undefined) {
    out.push(
      mode === 'MIXED'
        ? pick(input, 'min-lease-mixed', [
            `Monthly plan: minimum term of ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
            `For the monthly plan, minimum term of ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
            `The monthly plan requires a minimum term of ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
          ])
        : pick(input, 'min-lease', [
            `Minimum term: ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
            `Minimum lease term: ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
            `Minimum commitment: ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
          ]),
    );
  }

  if (input.depositMonths !== undefined) {
    out.push(
      pick(input, 'deposit', [
        `Security deposit required: ${input.depositMonths} ${pluralEn(input.depositMonths, "month's", "months'")} rent.`,
        `A deposit of ${input.depositMonths} ${pluralEn(input.depositMonths, "month's", "months'")} rent is required.`,
        `Deposit: ${input.depositMonths} ${pluralEn(input.depositMonths, "month's", "months'")} rent.`,
      ]),
    );
  }

  if (input.chargesIncluded !== undefined) {
    out.push(
      pick(
        input,
        'charges',
        input.chargesIncluded
          ? [
              'Utilities included.',
              'Rental charges are included in the rent.',
              'Utilities included in the rent.',
            ]
          : [
              'Utilities not included.',
              'Rental charges are not included in the rent.',
              'Utilities are extra.',
            ],
      ),
    );
  }

  if (input.minimumNights !== undefined) {
    out.push(
      pick(input, 'min-nights', [
        `Minimum stay: ${input.minimumNights} ${pluralEn(input.minimumNights, 'night')}.`,
        `Minimum stay length: ${input.minimumNights} ${pluralEn(input.minimumNights, 'night')}.`,
        `${input.minimumNights} ${pluralEn(input.minimumNights, 'night')} minimum per stay.`,
      ]),
    );
  }

  if (input.maximumNights !== undefined) {
    out.push(
      pick(input, 'max-nights', [
        `Maximum stay: ${input.maximumNights} ${pluralEn(input.maximumNights, 'night')}.`,
        `Maximum stay length: ${input.maximumNights} ${pluralEn(input.maximumNights, 'night')}.`,
        `${input.maximumNights} ${pluralEn(input.maximumNights, 'night')} maximum per stay.`,
      ]),
    );
  }

  if (input.cleaningFee !== undefined) {
    out.push(
      pick(input, 'cleaning-fee', [
        `Cleaning fee: ${formatAmountEn(input.cleaningFee)} FCFA.`,
        `A cleaning fee of ${formatAmountEn(input.cleaningFee)} FCFA applies.`,
        `Cleaning surcharge: ${formatAmountEn(input.cleaningFee)} FCFA.`,
      ]),
    );
  }

  return out;
}

const CLOSING_FR = [
  'Contactez-nous pour en savoir plus ou organiser une visite.',
  "N'hésitez pas à nous contacter pour toute question ou pour planifier une visite.",
  'Pour plus de détails ou une visite, prenez contact dès maintenant.',
];

const CLOSING_EN = [
  'Contact us to learn more or arrange a visit.',
  'Feel free to reach out with any questions or to schedule a visit.',
  'For more details or to arrange a visit, get in touch today.',
];

/**
 * Génère une description de 2 à 4 courts paragraphes à partir des SEULS
 * champs fournis — jamais d'invention (cf. Milo.md § Writer). Déterministe :
 * la même combinaison de champs produit toujours le même texte. Le
 * paragraphe de clôture est générique (aucune donnée du bien) : il garantit
 * au moins 2 paragraphes même avec un minimum de champs saisis.
 */
export function generateDescription(input: WriterInput): string {
  const isFr = input.locale === 'fr';
  const paragraphs: string[] = [];

  const opening = isFr ? openingFr(input) : openingEn(input);
  const characteristics = isFr
    ? characteristicsFr(input)
    : characteristicsEn(input);
  const furnished = isFr ? furnishedFr(input) : furnishedEn(input);
  const amenities = isFr ? amenitiesFr(input) : amenitiesEn(input);
  const pricing = isFr ? pricingFr(input) : pricingEn(input);
  const closing = pick(input, 'closing', isFr ? CLOSING_FR : CLOSING_EN);

  // Paragraphe 1 — ouverture + caractéristiques/ameublement (toujours présent).
  const p1 = [opening, characteristics, furnished].filter((s): s is string =>
    Boolean(s),
  );
  paragraphs.push(p1.join(' '));

  // Paragraphe équipements (si présents).
  if (amenities) paragraphs.push(amenities);

  // Prix/conditions — regroupés pour ne jamais dépasser 4 paragraphes au
  // total avec l'ouverture et la clôture (toutes deux obligatoires).
  if (pricing.length > 0) {
    const maxPricingParagraphs = Math.max(1, 4 - 2 - (amenities ? 1 : 0));
    const chunkSize = Math.ceil(pricing.length / maxPricingParagraphs);
    for (let i = 0; i < pricing.length; i += chunkSize) {
      paragraphs.push(pricing.slice(i, i + chunkSize).join(' '));
    }
  }

  // Clôture — générique, jamais de donnée du bien (garantit ≥ 2 paragraphes).
  paragraphs.push(closing);

  return paragraphs.filter((p) => p.length > 0).join('\n\n');
}
