import { sanitizeContactInfo } from './contact-filter.util';

describe('sanitizeContactInfo', () => {
  it('masque un numéro sénégalais écrit avec espaces', () => {
    const { content, wasFiltered } = sanitizeContactInfo('Appelle-moi au 77 123 45 67 stp');
    expect(wasFiltered).toBe(true);
    expect(content).toContain('[numéro masqué]');
    expect(content).not.toContain('123');
  });

  it('masque un numéro avec préfixe +221 et tirets', () => {
    const { content, wasFiltered } = sanitizeContactInfo('Contact: +221-77-123-45-67');
    expect(wasFiltered).toBe(true);
    expect(content).toContain('[numéro masqué]');
  });

  it('masque une mention WhatsApp (insensible à la casse)', () => {
    const { content, wasFiltered } = sanitizeContactInfo('Ecris-moi sur WhatsApp plutôt');
    expect(wasFiltered).toBe(true);
    expect(content).toContain('[application masquée]');
  });

  it('laisse un prix intact (pas de faux positif)', () => {
    const { content, wasFiltered } = sanitizeContactInfo('Le loyer est de 250 000 FCFA par mois');
    expect(wasFiltered).toBe(false);
    expect(content).toBe('Le loyer est de 250 000 FCFA par mois');
  });

  it('laisse une date au format JJ/MM/AAAA intacte', () => {
    const { content, wasFiltered } = sanitizeContactInfo('Je suis dispo le 23/08/2026');
    expect(wasFiltered).toBe(false);
    expect(content).toBe('Je suis dispo le 23/08/2026');
  });

  it('laisse un message normal totalement intact', () => {
    const { content, wasFiltered } = sanitizeContactInfo('Bonjour, l\'appartement est-il toujours disponible ?');
    expect(wasFiltered).toBe(false);
    expect(content).toBe('Bonjour, l\'appartement est-il toujours disponible ?');
  });
});
