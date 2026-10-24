import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Config de capture — PLAN_CAPTURE.md § 7. Un seul projet « mobile » :
// 390×844, échelle 3 (netteté), tactile, thème sombre forcé, fr-FR,
// fuseau Africa/Dakar, 1 seul worker (sessions Clerk/base de démo
// partagées, pas de parallélisme), 0 relance (une capture ratée doit être
// vue, pas masquée par un retry silencieux).
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: path.join(__dirname, '..', 'captures', '_playwright-artifacts'),
  use: {
    baseURL: process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000',
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    colorScheme: 'dark',
    video: 'off', // activé scène par scène (recordVideo du contexte), pas globalement
    screenshot: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
