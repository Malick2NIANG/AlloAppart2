// Connexion Clerk réutilisable pour les scripts Playwright de ce chantier —
// instance de DÉVELOPPEMENT uniquement (vérifie sk_test_*, refuse sinon).
// Se connecte par le VRAI formulaire /sign-in (e-mail + mot de passe), dans
// un contexte Playwright unique — ce qui établit le cookie __client que
// Clerk exige pour le rafraîchissement silencieux côté serveur.
//
// Comptes utilisés : 4 comptes de test dédiés (adresses synthétiques
// `aa-test-<rôle>+clerk_test@example.com`, provisionnés par
// provision-test-accounts.mjs). Identifiants lus depuis .credentials.env
// (gitignoré, jamais affiché ni commité).
//
// HISTORIQUE : une première version de cet outil utilisait un jeton
// "sign_in_token" (strategy "ticket"), qui fonctionne pour toute page
// 'use client' mais N'ÉTABLIT PAS le cookie __client — donc jamais reconnu
// par un Server Component (`auth()`). D'où le passage au vrai formulaire.
//
// Usage : import { openAs, ROLE_ACCOUNTS } from './clerk-session.mjs';
//         const { browser, context, page, close } = await openAs('LOCATAIRE');
//         ... utiliser page directement, dans le MÊME contexte ...
//         await close();

import { chromium } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, '../../../Backend/.env'));
process.loadEnvFile(path.resolve(__dirname, '../../.env.local'));

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!SECRET_KEY) throw new Error('CLERK_SECRET_KEY absente de Backend/.env.');
if (!SECRET_KEY.startsWith('sk_test_')) throw new Error('CLERK_SECRET_KEY non-test (sk_test_) — abandon par sécurité.');

const CREDENTIALS_PATH = path.resolve(__dirname, '.credentials.env');
try {
  process.loadEnvFile(CREDENTIALS_PATH);
} catch {
  throw new Error(`${CREDENTIALS_PATH} introuvable — lance d'abord provision-test-accounts.mjs.`);
}

export const FRONTEND_URL = process.env.FRONTEND_PUBLIC_URL ?? 'http://localhost:3000';

export const ROLE_ACCOUNTS = {
  LOCATAIRE:     { checkPath: '/locataire' },
  BAILLEUR:      { checkPath: '/bailleur'  },
  PRO_AGENCE:    { checkPath: '/bailleur'  },
  AGENT_TERRAIN: { checkPath: '/agent'     },
};

let clerkSetupDone = null;
function ensureClerkSetup() {
  // Mémoïsé : clerkSetup() fait un appel réseau à Clerk, inutile de le
  // refaire à chaque openAs() dans un même process.
  clerkSetupDone ??= clerkSetup({
    secretKey: SECRET_KEY,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
  return clerkSetupDone;
}

/**
 * Ouvre un navigateur, se connecte au rôle demandé par le vrai formulaire
 * /sign-in, et retourne la page prête à l'emploi — tout dans le MÊME
 * contexte Playwright (pas de storageState enregistré puis rechargé).
 * @param {keyof typeof ROLE_ACCOUNTS} role
 * @param {{ viewport?: {width:number,height:number}, isMobile?: boolean, hasTouch?: boolean }} opts
 */
export async function openAs(role, opts = {}) {
  const account = ROLE_ACCOUNTS[role];
  if (!account) throw new Error(`Rôle inconnu : ${role}. Rôles disponibles : ${Object.keys(ROLE_ACCOUNTS).join(', ')}`);

  const email = process.env[`AA_TEST_${role}_EMAIL`];
  const password = process.env[`AA_TEST_${role}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Identifiants manquants pour ${role} dans .credentials.env — relance provision-test-accounts.mjs.`);
  }

  await ensureClerkSetup();

  const browser = await chromium.launch();
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  // Contourne la protection anti-bot de Clerk pour ce navigateur piloté par
  // Playwright (sans quoi un vrai formulaire peut afficher un défi au lieu
  // de se soumettre) — n'affecte pas l'établissement du cookie __client.
  await setupClerkTestingToken({ page });

  await page.goto(`${FRONTEND_URL}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 40000 });

  // Attend que Clerk ait réellement fini de s'hydrater avant de toucher au
  // formulaire : remplir trop tôt fait courir le risque que Clerk réinitialise
  // l'état contrôlé du champ (React) juste après, effaçant la saisie — observé
  // en diagnostic (champ e-mail vide au moment du clic, bloqué par la
  // validation native du navigateur, sans aucune requête vers Clerk).
  await page.waitForFunction(() => Boolean(window.Clerk?.loaded), { timeout: 20000 });
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10000 });

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.fill(email);
  // Vérifie par lecture (jamais journalisée) que la valeur a bien pris — si
  // Clerk a réinitialisé le champ entre-temps, on la remplit une seconde fois.
  if ((await emailInput.inputValue()) !== email) {
    await emailInput.fill(email);
  }
  await passwordInput.fill(password);
  if ((await passwordInput.inputValue()) !== password) {
    await passwordInput.fill(password);
  }

  const emailFilled = (await emailInput.inputValue()).length > 0;
  const passwordFilled = (await passwordInput.inputValue()).length > 0;
  if (!emailFilled || !passwordFilled) {
    await browser.close();
    throw new Error(`Champ(s) vide(s) juste avant la soumission pour ${role} (email: ${emailFilled}, password: ${passwordFilled}).`);
  }

  await page.locator('button[type="submit"]').click();

  // Sondage plutôt que page.waitForURL(prédicat) : plus fiable ici — le
  // SDK Clerk navigue via window.location.replace(), que waitForURL rate
  // parfois selon le timing exact de l'événement de navigation.
  let signedIn = false;
  for (let i = 0; i < 25 && !signedIn; i++) {
    await page.waitForTimeout(400);
    signedIn = !page.url().includes('/sign-in');
  }
  if (!signedIn) {
    const flash = await page.locator('[class*="red-"]').first().textContent().catch(() => null);
    await browser.close();
    throw new Error(`Connexion par formulaire refusée pour ${role} (toujours sur /sign-in)${flash ? ` — ${flash}` : ''}.`);
  }
  await page.waitForTimeout(800);

  return {
    browser, context, page, role, checkPath: account.checkPath,
    close: () => browser.close(),
  };
}
