import path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import { primeBrowserState } from './lib/wait';

// Connexion par compte de démo — méthode CORRIGÉE (PLAN_CAPTURE.md § 4,
// « Décisions validées — correction de connexion », 24 octobre 2026) :
// les sessions par jeton Clerk ne fonctionnent pas sur les espaces
// connectés (rendu serveur, ClerkAuthGuard). Connexion par le VRAI
// formulaire /sign-in, comme Frontend/rapports-mobile/tools/clerk-session.mjs
// — attend window.Clerk.loaded avant de toucher au formulaire (sinon Clerk
// réinitialise un champ rempli trop tôt), revérifie chaque champ après
// saisie, n'utilise jamais skip_password_requirement.

process.loadEnvFile(path.resolve(__dirname, '.credentials.env'));

export type DemoRole =
  | 'demo-locataire' | 'demo-bailleur' | 'demo-bailleur-2' | 'demo-agence'
  | 'demo-agent' | 'demo-agent-2' | 'demo-locataire-2' | 'demo-locataire-3';

const CHECK_PATH: Record<DemoRole, string> = {
  'demo-locataire': '/locataire',
  'demo-bailleur': '/bailleur',
  'demo-bailleur-2': '/bailleur',
  'demo-agence': '/bailleur',
  'demo-agent': '/agent',
  'demo-agent-2': '/agent',
  'demo-locataire-2': '/locataire',
  'demo-locataire-3': '/locataire',
};

export const FRONTEND_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';

function credsFor(role: DemoRole): { email: string; password: string } {
  const envKey = role.toUpperCase().replace(/-/g, '_');
  const email = process.env[`${envKey}_EMAIL`];
  const password = process.env[`${envKey}_PASSWORD`];
  if (!email || !password) {
    throw new Error(
      `${envKey}_EMAIL / ${envKey}_PASSWORD absents de capture/.credentials.env — ` +
        `lance d'abord node scripts/provision-demo-accounts.mjs`,
    );
  }
  return { email, password };
}

/**
 * Ouvre une session réelle (formulaire /sign-in) pour le rôle de démo
 * donné, dans un contexte Playwright neuf. Retourne `{ browser, context,
 * page, close }` — utiliser `page` directement, dans le MÊME contexte,
 * puis appeler `close()`.
 */
export async function openAs(role: DemoRole): Promise<{
  browser: Browser; context: BrowserContext; page: Page; close: () => Promise<void>;
}> {
  const { email, password } = credsFor(role);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await primeBrowserState(page);

  await page.goto(`${FRONTEND_URL}/sign-in`, { waitUntil: 'networkidle' });

  // Attendre que Clerk ait fini de charger AVANT de toucher au formulaire —
  // sinon Clerk réinitialise un champ déjà rempli (cause racine documentée
  // dans clerk-session.mjs, déjà rencontrée et corrigée sur ce projet).
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded), { timeout: 20_000 });

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.fill(email);
  if ((await emailInput.inputValue()) !== email) await emailInput.fill(email);
  await passwordInput.fill(password);
  if ((await passwordInput.inputValue()) !== password) await passwordInput.fill(password);

  if ((await emailInput.inputValue()) !== email || (await passwordInput.inputValue()) !== password) {
    throw new Error('Champs de connexion vides après saisie — abandon (voir clerk-session.mjs pour la cause connue).');
  }

  // Connexion réussie (mot de passe) : SignInForm.tsx fait
  // `window.location.replace('/')` — pas de redirection automatique par
  // rôle (celle-ci n'existe que pour le parcours Google OAuth, via
  // /sso-callback puis /redirect). On attend l'atterrissage sur "/", puis
  // on navigue nous-mêmes vers l'espace du rôle (session déjà active).
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
  await page.goto(`${FRONTEND_URL}${CHECK_PATH[role]}`, { waitUntil: 'networkidle' });
  if (!page.url().startsWith(`${FRONTEND_URL}${CHECK_PATH[role]}`)) {
    throw new Error(`Connexion échouée pour ${role} : redirigé vers ${page.url()} au lieu de ${CHECK_PATH[role]}`);
  }

  return {
    browser, context, page,
    close: async () => { await context.close(); await browser.close(); },
  };
}
