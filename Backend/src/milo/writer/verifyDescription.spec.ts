import { verifyDescription } from './verifyDescription';
import type { WriterInput } from './types';

const base: WriterInput = {
  locale: 'fr',
  type: 'APPARTEMENT',
  city: 'Dakar',
  surface: 85,
  rooms: 3,
  amenities: ['wifi'],
};

describe('verifyDescription — contrôle anti-invention', () => {
  it('accepte un texte entièrement fondé sur les champs', () => {
    const text =
      'Cet appartement est à louer à Dakar. Il dispose de 85 m², 3 pièces. Il bénéficie de : Wi-Fi.';
    expect(verifyDescription(text, base).ok).toBe(true);
  });

  it('rejette un nombre absent des champs (surface inventée)', () => {
    const text = 'Cet appartement est à louer à Dakar. Il dispose de 120 m².';
    const result = verifyDescription(text, base);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('120'))).toBe(true);
  });

  it('rejette un équipement non coché (piscine jamais cochée)', () => {
    const text =
      'Cet appartement est à louer à Dakar. Vous profiterez de : Piscine.';
    const result = verifyDescription(text, base);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('piscine'))).toBe(true);
  });

  it('rejette un type de bien différent mentionné dans le texte', () => {
    const text = 'Cette villa est à louer à Dakar.';
    const result = verifyDescription(text, base);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('VILLA'))).toBe(true);
  });

  it("rejette l'ameublement mentionné sans champ furnished renseigné", () => {
    const text = 'Cet appartement est à louer à Dakar. Le bien est meublé.';
    const result = verifyDescription(text, base);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('furnished'))).toBe(true);
  });

  it('accepte « X bedroom(s) »/« X room(s) » sans faux positif sur le type CHAMBRE (EN)', () => {
    const input: WriterInput = {
      locale: 'en',
      type: 'VILLA',
      city: 'Ngor',
      rooms: 5,
      beds: 4,
      baths: 3,
    };
    const text =
      'This villa is available for rent in Ngor. It offers 5 rooms, 4 bedrooms and 3 bathrooms.';
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('accepte « X chambre(s) » sans faux positif sur le type CHAMBRE (FR)', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'VILLA',
      city: 'Ngor',
      beds: 4,
    };
    const text = 'Cette villa est à louer à Ngor. Elle dispose de 4 chambres.';
    expect(verifyDescription(text, input).ok).toBe(true);
  });

  it('rejette un mot interdit (« calme ») absent de tout champ', () => {
    const text = 'Cet appartement est à louer à Dakar, dans un quartier calme.';
    const result = verifyDescription(text, base).ok;
    expect(result).toBe(false);
  });

  it("accepte « titre foncier » uniquement si l'équipement titre_foncier est coché", () => {
    const withTitle: WriterInput = {
      locale: 'fr',
      type: 'TERRAIN',
      city: 'Diamniadio',
      amenities: ['titre_foncier'],
    };
    const text =
      'Ce terrain est à vendre à Diamniadio. Vous profiterez de : Titre foncier.';
    expect(verifyDescription(text, withTitle).ok).toBe(true);
  });

  it("rejette « titre foncier » si l'équipement titre_foncier n'est pas coché", () => {
    const withoutTitle: WriterInput = {
      locale: 'fr',
      type: 'TERRAIN',
      city: 'Diamniadio',
      amenities: [],
    };
    const text =
      'Ce terrain est à vendre à Diamniadio. Titre foncier disponible.';
    const result = verifyDescription(text, withoutTitle);
    expect(result.ok).toBe(false);
  });

  it('rejette une phrase de gabarit qui référencerait un champ vide (prix absent)', () => {
    const noPriceInput: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
    };
    const text =
      'Cet appartement est à louer à Dakar. Loyer mensuel : 150 000 FCFA.';
    const result = verifyDescription(text, noPriceInput);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('150000'))).toBe(true);
  });
});
