import { tokenize, matchPhraseAt } from './tokenize';

describe('tokenize', () => {
  it('découpe sur les espaces et indexe chaque token', () => {
    expect(tokenize('f3 climatise a louer')).toEqual([
      { raw: 'f3', index: 0 },
      { raw: 'climatise', index: 1 },
      { raw: 'a', index: 2 },
      { raw: 'louer', index: 3 },
    ]);
  });

  it('retourne un tableau vide pour une chaîne vide', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('retire la virgule de fin de mot ("chambres,")', () => {
    expect(tokenize('3 chambres, 2 bedrooms').map((t) => t.raw)).toEqual([
      '3',
      'chambres',
      '2',
      'bedrooms',
    ]);
  });

  it('préserve un nombre décimal à virgule ("1,5")', () => {
    expect(tokenize('1,5 million').map((t) => t.raw)).toEqual([
      '1,5',
      'million',
    ]);
  });

  it('retire la virgule finale même sur un nombre décimal suivi de ponctuation ("1,5,")', () => {
    expect(tokenize('budget 1,5,').map((t) => t.raw)).toEqual([
      'budget',
      '1,5',
    ]);
  });

  it("filtre les tokens vides issus d'espaces multiples", () => {
    expect(tokenize('villa  a vendre').map((t) => t.raw)).toEqual([
      'villa',
      'a',
      'vendre',
    ]);
  });
});

describe('matchPhraseAt', () => {
  const tokens = tokenize('chambre a louer meublee');

  it('retourne le nombre de tokens consommés pour une phrase qui correspond', () => {
    expect(matchPhraseAt(tokens, 0, 'chambre a louer')).toBe(3);
  });

  it('retourne 0 si la phrase ne correspond pas à partir de cet indice', () => {
    expect(matchPhraseAt(tokens, 1, 'chambre a louer')).toBe(0);
  });

  it('retourne 0 si la phrase dépasse la fin des tokens', () => {
    expect(matchPhraseAt(tokens, 3, 'meublee studio')).toBe(0);
  });

  it('fait correspondre un mot unique', () => {
    expect(matchPhraseAt(tokens, 3, 'meublee')).toBe(1);
  });
});
