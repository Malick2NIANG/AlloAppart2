import * as fs from 'fs';
import * as path from 'path';
import { detectLanguage } from './detectLanguage';

describe('detectLanguage — signal principal (dictionnaire)', () => {
  it('phrase FR claire → fr, méthode dictionary', () => {
    const r = detectLanguage('Je cherche un appartement a louer a Dakar', 'fr');
    expect(r.language).toBe('fr');
    expect(r.method).toBe('dictionary');
  });

  it('phrase EN claire → en, méthode dictionary', () => {
    const r = detectLanguage(
      'I am looking for an apartment for rent in Dakar',
      'fr',
    );
    expect(r.language).toBe('en');
    expect(r.method).toBe('dictionary');
  });

  it('une langue gagne dès qu\'elle a strictement plus de signaux, même sur une requête courte ("2 chambres", 2 mots)', () => {
    const r = detectLanguage('2 chambres', 'en');
    expect(r.language).toBe('fr');
    expect(r.method).toBe('dictionary');
  });

  it('idem côté EN ("for rent", 2 mots)', () => {
    const r = detectLanguage('for rent', 'fr');
    expect(r.language).toBe('en');
    expect(r.method).toBe('dictionary');
  });

  it('phrase mélangée : décision par les signaux, pas par le nombre de mots de chaque langue', () => {
    // "chambres" (fr, beds) + "near the sea" (en, softPreference) → en gagne
    // (1 signal fr vs signal(s) en), documenté comme exigé par le lot 3.
    const r = detectLanguage('2 chambres climatisees near the sea', 'fr');
    expect(r.language).toBe('en');
    expect(r.method).toBe('dictionary');
  });
});

describe('detectLanguage — égalité et repli', () => {
  it('nom de lieu seul ("villa Almadies") : jamais la bibliothèque, repli sur defaultLocale', () => {
    const r = detectLanguage('villa Almadies', 'fr');
    expect(r.language).toBe('fr');
    expect(r.method).toBe('default');

    const rEn = detectLanguage('villa Almadies', 'en');
    expect(rEn.language).toBe('en');
    expect(rEn.method).toBe('default');
  });

  it('égalité ET moins de 4 mots → defaultLocale, confiance basse', () => {
    const r = detectLanguage('sea view', 'fr');
    expect(r.language).toBe('fr');
    expect(r.method).toBe('default');
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('égalité ET au moins 4 mots → tente la bibliothèque (pas un repli immédiat)', () => {
    const r = detectLanguage('Maison for rent a Rufisque', 'fr');
    // Résultat non contraint ici (dépend de tinyld sur du code-switching,
    // documenté comme un cas limite dans le rapport du lot 3) — on vérifie
    // seulement que la méthode n'est jamais 'dictionary' (pas de signal
    // strictement majoritaire) et que le résultat reste une langue valide.
    expect(r.method).not.toBe('dictionary');
    expect(['fr', 'en', 'unsupported']).toContain(r.language);
  });

  it('chaîne vide → defaultLocale, confiance basse', () => {
    const r = detectLanguage('', 'fr');
    expect(r.language).toBe('fr');
    expect(r.method).toBe('default');
  });
});

describe('detectLanguage — langue tierce (unsupported)', () => {
  it('phrase clairement portugaise, 4+ mots → unsupported avec confiance correcte', () => {
    const r = detectLanguage(
      'Procuro um apartamento para alugar em Lisboa',
      'fr',
    );
    expect(r.language).toBe('unsupported');
    expect(r.method).toBe('library');
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('phrase clairement italienne, 4+ mots → unsupported', () => {
    const r = detectLanguage(
      'Voglio affittare una villa tranquilla e sicura',
      'fr',
    );
    expect(r.language).toBe('unsupported');
  });

  it('ne classe jamais en "en" un texte italien à cause du mot partagé "in" (régression, bug trouvé puis corrigé au lot 3)', () => {
    const r = detectLanguage(
      'Cerco un appartamento in affitto in centro',
      'fr',
    );
    expect(r.language).not.toBe('en');
  });

  it('un résultat de bibliothèque peu sûr ne force jamais fr/en/unsupported à la légère : repli sur defaultLocale', () => {
    // Texte latinisé ambigu — la bibliothèque n'est pas assez confiante,
    // le repli doit être sûr (defaultLocale), jamais une mauvaise langue
    // affirmée avec une confiance à peine au-dessus de 0,5.
    const r = detectLanguage("Ureedu an asta'jir fila hadia wa amina", 'fr');
    if (r.method === 'library') {
      expect(r.confidence).toBeGreaterThanOrEqual(0.55);
    } else {
      expect(r.method).toBe('default');
    }
  });
});

describe('detectLanguage — confiance', () => {
  it("n'est jamais >= 1 (heuristique, jamais une certitude absolue)", () => {
    const texts = [
      'Je cherche un appartement a louer a Dakar',
      'I am looking for an apartment for rent in Dakar',
      'villa Almadies',
      '',
    ];
    for (const t of texts) {
      expect(detectLanguage(t, 'fr').confidence).toBeLessThan(1);
    }
  });

  it('est toujours entre 0 et 1', () => {
    const texts = [
      '2 chambres',
      'for rent',
      'sea view',
      'Voglio affittare una villa',
    ];
    for (const t of texts) {
      const c = detectLanguage(t, 'fr').confidence;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

describe('detectLanguage — defaultLocale respecté', () => {
  it('defaultLocale=en change le repli, jamais le résultat dictionary', () => {
    expect(detectLanguage('villa Almadies', 'en').language).toBe('en');
    expect(detectLanguage('villa Almadies', 'fr').language).toBe('fr');
    // Un signal clair ignore defaultLocale.
    expect(detectLanguage('2 chambres', 'en').language).toBe('fr');
  });
});

describe('detectLanguage — jeu de test complet (Backend/src/milo/tests/language.json)', () => {
  interface Entry {
    category: 'fr' | 'en' | 'mixed' | 'short' | 'other';
    defaultLocale: 'fr' | 'en';
    expectedLanguage: 'fr' | 'en' | 'unsupported';
    query: string;
  }

  const dataPath = path.resolve(__dirname, '../tests/language.json');
  const entries = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as Entry[];

  function wordCount(q: string): number {
    return q.trim().split(/\s+/).filter(Boolean).length;
  }

  it('contient bien 60 FR + 60 EN + 30 mixtes + 20 courtes + 20 autres langues (190 au total)', () => {
    const counts = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ fr: 60, en: 60, mixed: 30, short: 20, other: 20 });
  });

  it('précision FR sur les requêtes de 4 mots et plus >= 90 %', () => {
    const subset = entries.filter(
      (e) => e.category === 'fr' && wordCount(e.query) >= 4,
    );
    const correct = subset.filter(
      (e) =>
        detectLanguage(e.query, e.defaultLocale).language ===
        e.expectedLanguage,
    ).length;
    expect(correct / subset.length).toBeGreaterThanOrEqual(0.9);
  });

  it('précision EN sur les requêtes de 4 mots et plus >= 90 %', () => {
    const subset = entries.filter(
      (e) => e.category === 'en' && wordCount(e.query) >= 4,
    );
    const correct = subset.filter(
      (e) =>
        detectLanguage(e.query, e.defaultLocale).language ===
        e.expectedLanguage,
    ).length;
    expect(correct / subset.length).toBeGreaterThanOrEqual(0.9);
  });

  it("p95 du temps d'exécution < 50 ms sur les 190 requêtes", () => {
    const durations: number[] = [];
    for (const e of entries) {
      const start = process.hrtime.bigint();
      detectLanguage(e.query, e.defaultLocale);
      durations.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.max(0, Math.ceil(0.95 * durations.length) - 1)];
    expect(p95).toBeLessThan(50);
  });

  it('la catégorie mixte suit le comportement documenté (décision par les signaux) pour chaque entrée', () => {
    const subset = entries.filter((e) => e.category === 'mixed');
    for (const e of subset) {
      const result = detectLanguage(e.query, e.defaultLocale);
      expect(result.language).toBe(e.expectedLanguage);
    }
  });

  it('la catégorie "courtes" suit le comportement documenté pour chaque entrée', () => {
    const subset = entries.filter((e) => e.category === 'short');
    for (const e of subset) {
      const result = detectLanguage(e.query, e.defaultLocale);
      expect(result.language).toBe(e.expectedLanguage);
    }
  });
});
