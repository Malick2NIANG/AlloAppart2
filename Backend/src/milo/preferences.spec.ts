import {
  scoreListingPreferences,
  parsePreferenceIds,
  isSoftPreferenceId,
} from './preferences';

describe('parsePreferenceIds', () => {
  it('tableau connu (déjà CSV→tableau côté DTO, comme amenities) → inchangé', () => {
    expect(parsePreferenceIds(['near_sea', 'quiet'])).toEqual([
      'near_sea',
      'quiet',
    ]);
  });
  it('valeur inconnue ignorée silencieusement, pas d’erreur', () => {
    expect(parsePreferenceIds(['near_sea', 'bogus', 'quiet'])).toEqual([
      'near_sea',
      'quiet',
    ]);
  });
  it('tableau entièrement inconnu → tableau vide', () => {
    expect(parsePreferenceIds(['bogus', 'autre'])).toEqual([]);
  });
  it('undefined/vide → tableau vide', () => {
    expect(parsePreferenceIds(undefined)).toEqual([]);
    expect(parsePreferenceIds([])).toEqual([]);
  });
});

describe('isSoftPreferenceId', () => {
  it.each(['near_sea', 'quiet', 'upscale'])('%s est reconnu', (id) => {
    expect(isSoftPreferenceId(id)).toBe(true);
  });
  it('identifiant inconnu rejeté', () => {
    expect(isSoftPreferenceId('romantic')).toBe(false);
  });
});

describe('scoreListingPreferences', () => {
  it('aucune préférence demandée → score 0', () => {
    expect(scoreListingPreferences('Villa vue mer', '', [])).toBe(0);
  });

  it('mot-clé dans le titre pondéré plus fort que dans la description', () => {
    const inTitle = scoreListingPreferences('Villa vue mer', '', ['near_sea']);
    const inDescription = scoreListingPreferences(
      'Villa',
      'proche de la plage',
      ['near_sea'],
    );
    expect(inTitle).toBeGreaterThan(inDescription);
    expect(inTitle).toBeGreaterThan(0);
    expect(inDescription).toBeGreaterThan(0);
  });

  it('1 préférence trouvée puis 2 préférences trouvées → score croissant', () => {
    const withOne = scoreListingPreferences('Villa calme', '', ['quiet']);
    const withTwo = scoreListingPreferences('Villa calme avec vue mer', '', [
      'quiet',
      'near_sea',
    ]);
    expect(withTwo).toBeGreaterThan(withOne);
  });

  it('aucun mot-clé trouvé → score 0 (jamais négatif, jamais d’erreur)', () => {
    expect(
      scoreListingPreferences('Appartement standard', 'Rien de particulier', [
        'near_sea',
        'quiet',
        'upscale',
      ]),
    ).toBe(0);
  });

  it('accents ignorés ("océan" trouvé par le mot-clé "ocean")', () => {
    expect(
      scoreListingPreferences('Villa près de l’océan', '', ['near_sea']),
    ).toBeGreaterThan(0);
  });

  it('fonctionne en anglais (seafront, luxury)', () => {
    expect(
      scoreListingPreferences('Seafront villa', '', ['near_sea']),
    ).toBeGreaterThan(0);
    expect(
      scoreListingPreferences('Luxury apartment', '', ['upscale']),
    ).toBeGreaterThan(0);
  });

  it('titre/description null/undefined : ne plante pas, score 0', () => {
    expect(scoreListingPreferences(null, undefined, ['near_sea'])).toBe(0);
  });

  it('égalité : deux annonces avec le même mot-clé au même endroit ont le même score', () => {
    const a = scoreListingPreferences('Villa calme', '', ['quiet']);
    const b = scoreListingPreferences('Maison calme', '', ['quiet']);
    expect(a).toBe(b);
  });
});
