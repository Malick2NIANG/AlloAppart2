import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// `test.globals` n'est pas activé (fichiers existants importent explicitement
// depuis 'vitest') — le nettoyage automatique du DOM entre tests de
// @testing-library/react dépend de la détection d'un `afterEach` global,
// donc on le déclenche nous-mêmes ici plutôt que d'activer `globals: true`.
afterEach(cleanup);

// jsdom n'implémente pas window.matchMedia (connu, jamais ajouté) — requis
// par MiloSearchBar (lot 5a, détection mobile pour le placeholder raccourci).
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
