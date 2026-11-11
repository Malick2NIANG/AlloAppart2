/**
 * Quartiers homonymes de mots courants (lot « quartiers homonymes de mots
 * courants ») — seuls ces 10 noms sont concernés, aucun autre quartier ne
 * change de comportement. Sans contexte de lieu, le mot reste un mot non
 * compris (unmatchedTokens), jamais un filtre deviné.
 *
 * Un numéro de secteur ("Liberté 6", "Sicap Liberté 2") est déjà géré en
 * amont par numberedDistricts.ts (consommé avant que ce garde-fou ne soit
 * jamais atteint) — aucune règle dédiée ici pour ce cas.
 */
import { fr } from '../dictionaries/fr';
import { en } from '../dictionaries/en';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';

const DICTIONARIES = [fr, en];

export const GATED_HOMONYMS = new Set([
  'liberte',
  'plateau',
  'golf',
  'amitie',
  'castors',
  'fass',
  'medina',
  'hann',
  'bopp',
  'sicap',
]);

/** Prépositions/marqueurs de lieu listés par la tâche — "près de"/"près du"
 * couvrent les deux formes rencontrées ("près du Golf", "près de Golf"). */
const PLACE_MARKERS = [
  'pres de',
  'pres du',
  'pres des',
  'a',
  'au',
  'aux',
  'dans',
  'vers',
  'in',
  'at',
  'near',
  'around',
  'quartier',
  'secteur',
  'zone',
];

const ROOM_COUNT_WORDS = new Set([
  'chambre',
  'chambres',
  'piece',
  'pieces',
  'room',
  'rooms',
  'bedroom',
  'bedrooms',
]);

const STOP_WORDS = new Set<string>();
for (const dict of DICTIONARIES)
  for (const w of dict.stopWords) STOP_WORDS.add(w);

const PROPERTY_TYPE_WORDS = new Set<string>();
for (const dict of DICTIONARIES) {
  for (const words of Object.values(dict.type)) {
    for (const w of words) PROPERTY_TYPE_WORDS.add(w);
  }
  PROPERTY_TYPE_WORDS.add(dict.chambreTypeWord);
  for (const w of dict.studioWords) PROPERTY_TYPE_WORDS.add(w);
}

function hasPrecedingMarker(tokens: Token[], idx: number): boolean {
  for (const marker of PLACE_MARKERS) {
    const words = marker.split(' ');
    const from = idx - words.length;
    if (from >= 0 && matchPhraseAt(tokens, from, marker) === words.length) {
      return true;
    }
  }
  return false;
}

function isPrecededByPropertyType(tokens: Token[], idx: number): boolean {
  const prev = tokens[idx - 1]?.raw;
  return !!prev && PROPERTY_TYPE_WORDS.has(prev);
}

/** Le mot précédent est-il lui-même un lieu reconnu (ex. « Dakar Plateau »,
 * région suivie d'un quartier) ? `isKnownPlaceToken` est fourni par
 * places.ts (région ou quartier/ville), jamais reconstruit ici — un seul
 * index de lieux. Unidirectionnel seulement (précédent, jamais suivant) :
 * un sens bidirectionnel ferait s'accepter mutuellement deux homonymes
 * adjacents ("Sicap Liberté" sans numéro — chacun "suivi"/"précédé" de
 * l'autre), tombant ensuite dans l'ambiguïté « plusieurs quartiers
 * différents » (règle 3 déjà existante) au lieu d'une résolution nette. */
function isPrecededByKnownPlace(
  tokens: Token[],
  idx: number,
  isKnownPlaceToken: (raw: string) => boolean,
): boolean {
  const prev = tokens[idx - 1]?.raw;
  return !!prev && isKnownPlaceToken(prev);
}

/** Vrai si, en dehors de `idx`, tous les autres tokens de la phrase sont des
 * mots vides, des nombres, un décompte de pièces, OU déjà consommés par un
 * autre extracteur (type, transaction, prix…) — le mot gaté reste alors le
 * seul mot porteur de sens ENCORE SANS FILTRE ("Plateau", "Plateau 3
 * chambres", mais aussi "local commercial à vendre plateau 30 000 000" où
 * type/transaction/prix sont déjà posés ailleurs). Vacuously vrai pour une
 * phrase d'un seul mot. `alreadyConsumed` vient de extractPlaces (déjà
 * calculé avant l'appel, jamais reconstruit ici). */
const DE_CONNECTORS = new Set(['de', 'du', 'des']);

function isSoleContentWord(
  tokens: Token[],
  idx: number,
  isConsumedElsewhere: (i: number) => boolean,
): boolean {
  // Exception « terrain de golf » (règle 3) : un type de bien consommé
  // ailleurs ne doit PAS devenir ignorable quand il est le complément direct
  // du mot gaté via "de/du/des" ("terrain DE golf" = un type d'activité,
  // jamais "un terrain AU Golf") — seul ce connecteur précis change quelque
  // chose ; "cherche local commercial a vendre plateau" (type déjà consommé
  // mais loin, séparé par la transaction) reste correctement ignoré.
  const precededByDeConnector = DE_CONNECTORS.has(tokens[idx - 1]?.raw ?? '');
  for (let i = 0; i < tokens.length; i++) {
    if (i === idx) continue;
    const isTypeImmediatelyBeforeConnector =
      precededByDeConnector && i === idx - 2;
    if (isConsumedElsewhere(i) && !isTypeImmediatelyBeforeConnector) continue;
    const raw = tokens[i].raw;
    if (STOP_WORDS.has(raw)) continue;
    if (ROOM_COUNT_WORDS.has(raw)) continue;
    if (/^\d+$/.test(raw)) continue;
    return false;
  }
  return true;
}

/**
 * Un homonyme de mot courant n'est accepté comme lieu que si un indice de
 * lieu est présent (règle 2) — sinon il reste dans unmatchedTokens, jamais
 * un filtre deviné (règle 3 : les exceptions citées par la tâche sont déjà
 * de simples conséquences de cette règle, aucune liste de phrases à part).
 */
export function hasHomonymPlaceContext(
  tokens: Token[],
  idx: number,
  isKnownPlaceToken: (raw: string) => boolean,
  isConsumedElsewhere: (i: number) => boolean,
): boolean {
  return (
    hasPrecedingMarker(tokens, idx) ||
    isPrecededByPropertyType(tokens, idx) ||
    isPrecededByKnownPlace(tokens, idx, isKnownPlaceToken) ||
    isSoleContentWord(tokens, idx, isConsumedElsewhere)
  );
}
