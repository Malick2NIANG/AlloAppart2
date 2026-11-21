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
  joinList,
} from './dictionaries/labels';

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
    fragments.push(`${Math.round(input.surface)} m²`);
  if (input.rooms !== undefined)
    fragments.push(`${input.rooms} ${pluralFr(input.rooms, 'pièce')}`);
  if (input.beds !== undefined)
    fragments.push(`${input.beds} ${pluralFr(input.beds, 'chambre')}`);
  if (input.baths !== undefined)
    fragments.push(
      `${input.baths} ${pluralFr(input.baths, 'salle', 'salles')} de bain`,
    );
  if (fragments.length === 0) return null;
  const joined = joinList(fragments, 'et');
  const pronoun = TYPE_PRONOUN_FR[input.type];
  const variants = [
    `${capitalize(pronoun)} dispose de ${joined}.`,
    `Caractéristiques : ${joined}.`,
    `Avec ${joined}, ce bien répond à vos besoins.`,
  ];
  return pick(input, 'characteristics', variants);
}

function furnishedFr(input: WriterInput): string | null {
  if (input.furnished === undefined) return null;
  const variants = input.furnished
    ? [
        'Le bien est meublé.',
        'Il est proposé entièrement meublé.',
        'Vous emménagez meublé, prêt à vivre.',
      ]
    : [
        'Le bien est non meublé.',
        'Il est proposé non meublé.',
        "Vous apportez votre propre mobilier : le bien n'est pas meublé.",
      ];
  return pick(input, 'furnished', variants);
}

function amenitiesFr(input: WriterInput): string | null {
  const selected = AMENITY_ORDER.filter((k) =>
    (input.amenities ?? []).includes(k),
  );
  if (selected.length === 0) return null;
  const labels = selected.map((k) => AMENITY_LABEL_FR[k]);
  const joined = joinList(labels, 'et');
  const pronoun = TYPE_PRONOUN_FR[input.type];
  const variants = [
    `Équipements disponibles : ${joined}.`,
    `${capitalize(pronoun)} bénéficie de : ${joined}.`,
    `Vous profiterez de : ${joined}.`,
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

  if (mode === 'MIXED' && input.minLeaseMonths !== undefined) {
    out.push(
      pick(input, 'mixed-threshold', [
        `Au-delà de ${input.minLeaseMonths} mois, le tarif mensuel s'applique.`,
        `À partir de ${input.minLeaseMonths} mois, la location bascule au tarif mensuel.`,
        `Séjour de plus de ${input.minLeaseMonths} mois : tarif mensuel applicable.`,
      ]),
    );
  } else if (mode === 'MONTHLY' && input.minLeaseMonths !== undefined) {
    out.push(
      pick(input, 'min-lease', [
        `Durée minimale de bail : ${input.minLeaseMonths} mois.`,
        `Bail d'une durée minimale de ${input.minLeaseMonths} mois.`,
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
    fragments.push(`${Math.round(input.surface)} sqm`);
  if (input.rooms !== undefined)
    fragments.push(`${input.rooms} ${pluralEn(input.rooms, 'room')}`);
  if (input.beds !== undefined)
    fragments.push(`${input.beds} ${pluralEn(input.beds, 'bedroom')}`);
  if (input.baths !== undefined)
    fragments.push(`${input.baths} ${pluralEn(input.baths, 'bathroom')}`);
  if (fragments.length === 0) return null;
  const joined = joinList(fragments, 'and');
  const variants = [
    `It offers ${joined}.`,
    `Key features: ${joined}.`,
    `With ${joined}, this property meets your needs.`,
  ];
  return pick(input, 'characteristics', variants);
}

function furnishedEn(input: WriterInput): string | null {
  if (input.furnished === undefined) return null;
  const variants = input.furnished
    ? [
        'The property is furnished.',
        'It comes fully furnished.',
        'You move in furnished, ready to live.',
      ]
    : [
        'The property is unfurnished.',
        'It is offered unfurnished.',
        'You bring your own furniture: the property is unfurnished.',
      ];
  return pick(input, 'furnished', variants);
}

function amenitiesEn(input: WriterInput): string | null {
  const selected = AMENITY_ORDER.filter((k) =>
    (input.amenities ?? []).includes(k),
  );
  if (selected.length === 0) return null;
  const labels = selected.map((k) => AMENITY_LABEL_EN[k]);
  const joined = joinList(labels, 'and');
  const variants = [
    `Available amenities: ${joined}.`,
    `It comes with: ${joined}.`,
    `You will enjoy: ${joined}.`,
  ];
  return pick(input, 'amenities', variants);
}

function pricingEn(input: WriterInput): string[] {
  const out: string[] = [];
  const isVente = input.transactionType === 'VENTE';

  if (isVente) {
    if (input.price !== undefined) {
      out.push(
        pick(input, 'price-vente', [
          `Sale price: ${formatAmount(input.price)} FCFA.`,
          `This property is listed for sale at ${formatAmount(input.price)} FCFA.`,
          `Asking price: ${formatAmount(input.price)} FCFA.`,
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
        `Available nightly (${formatAmount(input.pricePerNight)} FCFA/night) or monthly (${formatAmount(input.price)} FCFA/month).`,
        `Flexible option: ${formatAmount(input.pricePerNight)} FCFA per night, or ${formatAmount(input.price)} FCFA for a month.`,
        `Two options available: nightly at ${formatAmount(input.pricePerNight)} FCFA, or monthly rental at ${formatAmount(input.price)} FCFA.`,
      ]),
    );
  } else {
    if ((mode === 'MONTHLY' || mode === 'MIXED') && input.price !== undefined) {
      out.push(
        pick(input, 'price-monthly', [
          `Monthly rent: ${formatAmount(input.price)} FCFA.`,
          `This property rents for ${formatAmount(input.price)} FCFA per month.`,
          `Monthly rate: ${formatAmount(input.price)} FCFA.`,
        ]),
      );
    }
    if (
      (mode === 'NIGHTLY' || mode === 'MIXED') &&
      input.pricePerNight !== undefined
    ) {
      out.push(
        pick(input, 'price-nightly', [
          `Rate: ${formatAmount(input.pricePerNight)} FCFA per night.`,
          `This property rents for ${formatAmount(input.pricePerNight)} FCFA per night.`,
          `Nightly rate: ${formatAmount(input.pricePerNight)} FCFA.`,
        ]),
      );
    }
  }

  if (mode === 'MIXED' && input.minLeaseMonths !== undefined) {
    out.push(
      pick(input, 'mixed-threshold', [
        `Beyond ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}, the monthly rate applies.`,
        `From ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')} onward, the stay switches to the monthly rate.`,
        `Stays longer than ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}: monthly rate applies.`,
      ]),
    );
  } else if (mode === 'MONTHLY' && input.minLeaseMonths !== undefined) {
    out.push(
      pick(input, 'min-lease', [
        `Minimum lease term: ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
        `Lease with a minimum term of ${input.minLeaseMonths} ${pluralEn(input.minLeaseMonths, 'month')}.`,
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
        `Cleaning fee: ${formatAmount(input.cleaningFee)} FCFA.`,
        `A cleaning fee of ${formatAmount(input.cleaningFee)} FCFA applies.`,
        `Cleaning surcharge: ${formatAmount(input.cleaningFee)} FCFA.`,
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
