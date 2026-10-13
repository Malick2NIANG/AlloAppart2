import { describe, it, expect } from 'vitest';
import { apiErrorDetail } from './apiError';

describe('apiErrorDetail', () => {
  it('joint les messages de validation (tableau) d’une erreur 400', () => {
    const err = { status: 400, data: { message: ['depositMonths must be an integer number', 'price must not be less than 0'] } };
    expect(apiErrorDetail(err)).toBe('depositMonths must be an integer number · price must not be less than 0');
  });

  it('renvoie le message d’une erreur 400 en chaîne', () => {
    expect(apiErrorDetail({ status: 400, data: { message: 'La région ne correspond pas à la position.' } }))
      .toBe('La région ne correspond pas à la position.');
  });

  it('renvoie null pour une erreur serveur ou inconnue', () => {
    expect(apiErrorDetail({ status: 500, data: { message: 'boom' } })).toBeNull();
    expect(apiErrorDetail(new Error('network'))).toBeNull();
    expect(apiErrorDetail(undefined)).toBeNull();
  });

  it('renvoie null sans message exploitable', () => {
    expect(apiErrorDetail({ status: 400, data: { message: [] } })).toBeNull();
    expect(apiErrorDetail({ status: 400, data: {} })).toBeNull();
  });

  it('tronque un message trop long', () => {
    const out = apiErrorDetail({ status: 400, data: { message: 'x'.repeat(500) } });
    expect(out).not.toBeNull();
    expect(out!.length).toBe(298);
    expect(out!.endsWith('…')).toBe(true);
  });
});
