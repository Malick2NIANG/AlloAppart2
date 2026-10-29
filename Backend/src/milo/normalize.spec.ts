import {
  stripAccents,
  normalizeText,
  levenshtein,
  isWordMatch,
} from './normalize';

describe('stripAccents', () => {
  it('retire les accents courants (é, è, à, ô, û, ç)', () => {
    expect(stripAccents('climatisé à vendre près côté çà')).toBe(
      'climatise a vendre pres cote ca',
    );
  });

  it('ne modifie pas une chaîne déjà sans accent', () => {
    expect(stripAccents('villa calme')).toBe('villa calme');
  });
});

describe('normalizeText', () => {
  it('met en minuscules et retire les accents', () => {
    expect(normalizeText('F3 CLIMATISÉ à Louer')).toBe('f3 climatise a louer');
  });

  it('uniformise les apostrophes courbes en apostrophe droite', () => {
    expect(normalizeText('jusqu’à 300k')).toBe("jusqu'a 300k");
  });

  it('conserve les chiffres, points, virgules et le signe %', () => {
    expect(normalizeText('1,5 million ou 350.000 FCFA, 50%')).toBe(
      '1,5 million ou 350.000 fcfa, 50%',
    );
  });

  it('remplace la ponctuation inconnue par un espace et aplatit les espaces multiples', () => {
    expect(normalizeText('villa  (climatisée) !!! à vendre')).toBe(
      'villa climatisee a vendre',
    );
  });

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('levenshtein', () => {
  it('distance 0 pour deux mots identiques', () => {
    expect(levenshtein('piscine', 'piscine')).toBe(0);
  });

  it("distance 1 pour une substitution d'une lettre", () => {
    expect(levenshtein('climatise', 'climatize')).toBe(1);
  });

  it('distance 1 pour une lettre manquante', () => {
    expect(levenshtein('piscine', 'piscne')).toBe(1);
  });

  it('distance 2 pour deux lettres différentes', () => {
    expect(levenshtein('gardien', 'gardula')).toBeGreaterThanOrEqual(2);
  });
});

describe('isWordMatch', () => {
  it('correspondance exacte toujours acceptée, quelle que soit la longueur', () => {
    expect(isWordMatch('clim', 'clim')).toBe(true);
    expect(isWordMatch('piscine', 'piscine')).toBe(true);
  });

  it('tolère une faute de frappe (distance 1) sur un mot-clé de 6+ caractères', () => {
    expect(isWordMatch('climatize', 'climatise')).toBe(true);
    expect(isWordMatch('piscne', 'piscine')).toBe(true);
  });

  it('ne tolère aucune faute sur un mot-clé de moins de 6 caractères', () => {
    expect(isWordMatch('clm', 'clim')).toBe(false);
    expect(isWordMatch('tv', 'tv')).toBe(true); // exact uniquement
    expect(isWordMatch('tvx', 'tv')).toBe(false);
  });

  it('rejette un mot trop différent même sur un mot-clé long', () => {
    expect(isWordMatch('bungalow', 'climatise')).toBe(false);
  });

  it('rejette si la différence de longueur dépasse 1', () => {
    expect(isWordMatch('pisc', 'piscine')).toBe(false);
  });
});
