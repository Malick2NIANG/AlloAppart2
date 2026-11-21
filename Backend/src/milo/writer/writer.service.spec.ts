import { Logger } from '@nestjs/common';
import { WriterService } from './writer.service';
import { verifyDescription } from './verifyDescription';
import * as generator from './generateDescription';
import type { WriterInput } from './types';

describe('WriterService — cas normal', () => {
  const service = new WriterService();

  it('retourne un texte qui passe le contrôle, fallback=false, pour une entrée valide', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      surface: 85,
      amenities: ['wifi'],
    };
    const result = service.write(input);
    expect(result.fallback).toBe(false);
    expect(verifyDescription(result.text, input).ok).toBe(true);
  });

  it('le repli ultime (type + lieu seuls) passe toujours le contrôle', () => {
    const minimal: WriterInput = {
      locale: 'en',
      type: 'TERRAIN',
      city: 'Diamniadio',
    };
    const result = service.write(minimal);
    expect(verifyDescription(result.text, minimal).ok).toBe(true);
  });
});

describe("WriterService — repli en cas d'échec du contrôle (generateDescription moquée)", () => {
  afterEach(() => jest.restoreAllMocks());

  it('replie sur la version minimale (sans amenities/furnished) si le texte complet échoue', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      amenities: ['wifi'],
      furnished: true,
    };
    jest
      .spyOn(generator, 'generateDescription')
      .mockImplementation((i: WriterInput) =>
        // N'échoue QUE pour l'appel complet (amenities présent) — le gabarit
        // inventerait un équipement non coché ('piscine').
        i.amenities
          ? 'Cet appartement est à louer à Dakar. Vous profiterez de : Piscine.'
          : 'Cet appartement est à louer à Dakar.',
      );

    const service = new WriterService();
    const result = service.write(input);

    expect(result.fallback).toBe(true);
    expect(result.text).toBe('Cet appartement est à louer à Dakar.');
    expect(verifyDescription(result.text, input).ok).toBe(true);
  });

  it('replie sur la version ultime (type + lieu seuls) si même la version minimale échoue', () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      surface: 85,
      amenities: ['wifi'],
    };
    jest
      .spyOn(generator, 'generateDescription')
      .mockImplementation((i: WriterInput) =>
        // Échoue pour le complet ET le minimal (surface toujours présente),
        // seul le repli ultime (sans surface) n'invente rien.
        i.surface
          ? 'Cet appartement est à louer à Dakar. Il dispose de 999 m².'
          : 'Cet appartement est à louer à Dakar.',
      );

    const service = new WriterService();
    const result = service.write(input);

    expect(result.fallback).toBe(true);
    expect(result.text).toBe('Cet appartement est à louer à Dakar.');
  });

  it("journalise l'échec sans aucune donnée personnelle (ville absente du message loggé)", () => {
    const input: WriterInput = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
      amenities: ['wifi'],
    };
    jest
      .spyOn(generator, 'generateDescription')
      .mockImplementation((i: WriterInput) =>
        i.amenities
          ? 'Cet appartement est à louer à Dakar. Vous profiterez de : Piscine.'
          : 'Cet appartement est à louer à Dakar.',
      );
    const logSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const service = new WriterService();
    service.write(input);

    expect(logSpy).toHaveBeenCalled();
    const loggedMessages = logSpy.mock.calls.map((c) => String(c[0]));
    expect(loggedMessages.some((m) => m.includes('Dakar'))).toBe(false);
    logSpy.mockRestore();
  });
});
