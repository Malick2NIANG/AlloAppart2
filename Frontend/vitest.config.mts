import { defineConfig, configDefaults } from 'vitest/config';

// motion/ est un projet Playwright/Remotion isolé (cf. motion/README.md) :
// ses *.spec.ts utilisent @playwright/test, pas Vitest. Sans cette
// exclusion, `vitest run` tente de les charger comme des tests Vitest et
// échoue (« Playwright Test did not expect test() to be called here »).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'motion/**'],
  },
});
