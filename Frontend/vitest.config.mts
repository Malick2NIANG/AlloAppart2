import { fileURLToPath } from 'node:url';
import { defineConfig, configDefaults } from 'vitest/config';

// motion/ est un projet Playwright/Remotion isolé (cf. motion/README.md) :
// ses *.spec.ts utilisent @playwright/test, pas Vitest. Sans cette
// exclusion, `vitest run` tente de les charger comme des tests Vitest et
// échoue (« Playwright Test did not expect test() to be called here »).
export default defineConfig({
  resolve: {
    // Reflète tsconfig.json `paths` (Next.js le résout lui-même via
    // webpack/Turbopack, mais Vite/Vitest l'ignore sans cet alias explicite
    // — requis à partir du lot 5, premiers tests de composants à importer
    // via « @/ »).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    exclude: [...configDefaults.exclude, 'motion/**'],
    // jsdom (lot 5, Milo) : requis par les nouveaux tests de composants
    // (MiloSearchBar, pastilles) — sans effet sur les tests de fonctions
    // pures existants, qui ne touchent pas au DOM.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
