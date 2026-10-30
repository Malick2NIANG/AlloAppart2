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

// jsdom n'implémente pas Element.scrollIntoView (connu, jamais ajouté) —
// requis par MessagesShell (lot messagerie mobile, défilement automatique
// des messages). Sans ce polyfill, l'appel lève une TypeError à l'intérieur
// d'un effet React après résolution d'une promesse (hors du flux await du
// test), ce qui bloquait la suite entière au lieu d'échouer proprement.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
