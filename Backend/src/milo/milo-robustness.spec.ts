import { MiloService } from './milo.service';

/**
 * Robustesse (lot 4) : un texte de 300 caractères pathologiques (répétitions,
 * chiffres, séparateurs, caractères de contrôle, émojis) ne doit jamais
 * lever d'erreur — protection contre une regex catastrophique dans l'un des
 * extracteurs (price.ts en particulier, seul extracteur à construire des
 * regex sur des motifs numériques répétés). La mesure de temps (p95 < 50 ms)
 * est volontairement HORS de cette suite Jest : exécutée en parallèle de
 * ~650 autres tests (suite complète), le p95 mesuré ici dépend du bruit du
 * runner (contention CPU entre workers Jest), pas de l'algorithme — un seuil
 * dur ici serait un flaky test, pas une vraie régression de performance
 * (observé en pratique : 1,23 ms en isolation, > 80 ms sous charge complète
 * sur la même machine, sans aucun changement de code). La mesure réelle se
 * fait avec Backend/scripts/milo-measure-robustness.ts, en isolation.
 */
describe('MiloService.parseQuery — robustesse sur texte pathologique (300 caractères)', () => {
  const service = new MiloService();

  const pathological: Record<string, string> = {
    lettresRepetees: 'a'.repeat(300),
    chiffresRepetes: '1'.repeat(300),
    separateursRepetes: '.,'.repeat(150),
    chiffresEtSeparateursAlternes: '1.2,3.4,5.6,'.repeat(25),
    espacesSeulement: ' '.repeat(300),
    unSeulGrandToken: '1234567890'.repeat(30),
    caracteresDeControle: (
      '\u0000\u0001\u0002\u001f'.repeat(20) + ' texte'
    ).slice(0, 300),
    emojis: '🏠🔑🏡💰'.repeat(75).slice(0, 300),
    melangeRealiste: (
      'F3 climatise '.repeat(10) +
      '350000 '.repeat(10) +
      'a louer a vendre '.repeat(5)
    ).slice(0, 300),
    nombresEnormes: '999999999999999999999999999999 '.repeat(9).slice(0, 300),
    kEtMRepetes: '350k 1.5m 2m 100k 50k 999k 1m '.repeat(10).slice(0, 300),
  };

  it.each(Object.entries(pathological))(
    '%s : aucune erreur levée',
    (_name, text) => {
      expect(() =>
        service.parseQuery({ text, defaultLocale: 'fr' }),
      ).not.toThrow();
    },
  );

  it.each(Object.entries(pathological))(
    '%s : retourne toujours une forme de réponse valide',
    (_name, text) => {
      const r = service.parseQuery({ text, defaultLocale: 'fr' });
      expect(typeof r.understood).toBe('boolean');
      expect(['fr', 'en', 'unsupported']).toContain(r.detectedLanguage);
      expect(Array.isArray(r.ambiguities)).toBe(true);
      expect(Array.isArray(r.unmatchedTokens)).toBe(true);
    },
  );

  it('texte de 300 caractères exactement (limite haute autorisée par le DTO) : sans erreur, compris', () => {
    const text = 'F3 climatise a louer sous 400000 a Dakar '
      .repeat(8)
      .slice(0, 300);
    const r = service.parseQuery({ text, defaultLocale: 'fr' });
    expect(r.understood).toBe(true);
  });
});
