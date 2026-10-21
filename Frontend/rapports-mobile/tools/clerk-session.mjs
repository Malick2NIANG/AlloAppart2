// Connexion Clerk réutilisable pour les scripts Playwright de ce chantier —
// instance de DÉVELOPPEMENT uniquement (vérifie sk_test_*, refuse sinon).
// Ne crée et ne modifie AUCUN compte : les comptes ci-dessous ont été
// repérés en lecture seule (psql, base de dev), un par rôle, non-ADMIN, non
// suspendu. Les clerkId sont des identifiants publics (ils ne donnent accès
// à rien sans la clé secrète serveur) — aucun secret, aucun e-mail réel
// n'est écrit dans ce fichier ni affiché en sortie.
//
// LIMITE CONNUE (confirmée en testant trois approches différentes) : une
// session créée par jeton "sign_in_token"/strategy "ticket" — que ce soit à
// la main (fetch + window.Clerk.client.signIn.create) ou via le paquet
// officiel @clerk/testing (clerk.signIn, stratégie ticket OU email — les
// deux utilisent le même mécanisme en interne) — fonctionne parfaitement
// pour toute page 'use client' (useAuth()/getToken() côté navigateur), mais
// N'EST PAS reconnue par le rendu serveur Next.js (`auth()` dans un Server
// Component). Ce n'est pas un bug de cet outil ni de l'app : Clerk documente
// ces sessions comme "client-side only", non validées côté serveur. Le
// contournement officiel est de se connecter via le vrai formulaire avec un
// compte de test à mot de passe connu — hors de portée ici (pas de mot de
// passe, pas de création de compte). Conséquence concrète : les routes
// (dashboard) — /locataire, /bailleur, /agent et leurs pages imbriquées —
// restent inatteignables avec `openAs()`, quelle que soit la méthode.
//
// Usage : import { openAs, ROLE_ACCOUNTS } from './clerk-session.mjs';
//         const { browser, context, page, close } = await openAs('LOCATAIRE');
//         ... utiliser page directement, dans le MÊME contexte ...
//         await close();

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, '../../../Backend/.env'));

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!SECRET_KEY) throw new Error('CLERK_SECRET_KEY absente de Backend/.env.');
if (!SECRET_KEY.startsWith('sk_test_')) throw new Error('CLERK_SECRET_KEY non-test (sk_test_) — abandon par sécurité.');

export const FRONTEND_URL = process.env.FRONTEND_PUBLIC_URL ?? 'http://localhost:3000';

export const ROLE_ACCOUNTS = {
  LOCATAIRE:     { clerkId: 'user_3GuAvqiAVKdhyDXGqCLwD5VNlpI', checkPath: '/locataire' },
  BAILLEUR:      { clerkId: 'user_3JbdiYQaXLEKf007WI1aIZdP0Xh', checkPath: '/bailleur'  },
  PRO_AGENCE:    { clerkId: 'user_3FaAKWAHlZ9Q5vjqpxfA60peTjz', checkPath: '/bailleur'  },
  AGENT_TERRAIN: { clerkId: 'user_3Fa9M6HWA3wqRXyHz706dGdC45O', checkPath: '/agent'     },
};

/**
 * Ouvre un navigateur, se connecte au rôle demandé, et retourne la page prête
 * à l'emploi — tout se passe dans le MÊME contexte Playwright, du jeton à la
 * navigation finale (pas de storageState enregistré puis rechargé).
 * @param {keyof typeof ROLE_ACCOUNTS} role
 * @param {{ viewport?: {width:number,height:number}, isMobile?: boolean, hasTouch?: boolean }} opts
 */
export async function openAs(role, opts = {}) {
  const account = ROLE_ACCOUNTS[role];
  if (!account) throw new Error(`Rôle inconnu : ${role}. Rôles disponibles : ${Object.keys(ROLE_ACCOUNTS).join(', ')}`);

  const tokenRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: account.clerkId, expires_in_seconds: 300 }),
  });
  if (!tokenRes.ok) throw new Error(`Échec de la demande de jeton Clerk pour ${role} (HTTP ${tokenRes.status}).`);
  const { token } = await tokenRes.json();
  if (!token) throw new Error(`Réponse Clerk sans jeton pour ${role}.`);

  const browser = await chromium.launch();
  const context = await browser.newContext(opts);
  const page = await context.newPage();

  // Échange du jeton via le SDK client Clerk exposé en global (`window.Clerk`)
  // — cette app a un formulaire de connexion maison (`useSignIn()`, voir
  // SignInForm.tsx) qui ne gère pas `__clerk_ticket` en paramètre d'URL.
  await page.goto(`${FRONTEND_URL}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForFunction(() => !!window.Clerk?.client, { timeout: 15000 });
  const result = await page.evaluate(async (ticket) => {
    try {
      const attempt = await window.Clerk.client.signIn.create({ strategy: 'ticket', ticket });
      if (attempt.status === 'complete') {
        await window.Clerk.setActive({ session: attempt.createdSessionId });
        return { ok: true };
      }
      return { ok: false, status: attempt.status };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  }, token);
  if (!result.ok) {
    await browser.close();
    throw new Error(`Échange du jeton Clerk refusé pour ${role} (${result.status ?? result.error ?? 'raison inconnue'}).`);
  }
  await page.waitForTimeout(1000);

  return {
    browser, context, page, role, checkPath: account.checkPath,
    close: () => browser.close(),
  };
}
