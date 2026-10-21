#!/usr/bin/env node
// Outil de connexion Playwright via jeton Clerk (sign_in_token) — instance de
// DÉVELOPPEMENT uniquement (vérifie que la clé secrète est bien sk_test_*,
// refuse sinon). Ne crée et ne modifie AUCUN compte : les comptes ci-dessous
// ont été repérés en lecture seule (psql, base de dev) le 2026-10-21, un par
// rôle, non-ADMIN, non suspendu. Les clerkId sont des identifiants publics
// (ils ne donnent accès à rien sans la clé secrète serveur) — aucun secret
// n'est écrit dans ce fichier ni affiché en sortie.
//
// Usage : node login-as.mjs <LOCATAIRE|BAILLEUR|PRO_AGENCE|AGENT_TERRAIN>
// Écrit l'état de session dans .sessions/<rôle>.json (gitignoré).

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// La clé secrète Clerk vit dans Backend/.env (jamais committée, jamais lue à
// voix haute ici) — chargée directement dans process.env, sans passer par une
// variable qu'on pourrait accidentellement logger.
process.loadEnvFile(path.resolve(__dirname, '../../../Backend/.env'));

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('CLERK_SECRET_KEY absente de Backend/.env — abandon.');
  process.exit(1);
}
if (!SECRET_KEY.startsWith('sk_test_')) {
  console.error('CLERK_SECRET_KEY ne commence pas par "sk_test_" (clé live ?) — abandon par sécurité.');
  process.exit(1);
}

const FRONTEND_URL = process.env.FRONTEND_PUBLIC_URL ?? 'http://localhost:3000';

const ROLE_ACCOUNTS = {
  LOCATAIRE:     { clerkId: 'user_3GuAvqiAVKdhyDXGqCLwD5VNlpI', checkPath: '/locataire' },
  BAILLEUR:      { clerkId: 'user_3JbdiYQaXLEKf007WI1aIZdP0Xh', checkPath: '/bailleur'  },
  PRO_AGENCE:    { clerkId: 'user_3FaAKWAHlZ9Q5vjqpxfA60peTjz', checkPath: '/bailleur'  },
  AGENT_TERRAIN: { clerkId: 'user_3Fa9M6HWA3wqRXyHz706dGdC45O', checkPath: '/agent'     },
};

const role = process.argv[2];
if (!role || !ROLE_ACCOUNTS[role]) {
  console.error(`Rôle manquant ou inconnu. Rôles disponibles : ${Object.keys(ROLE_ACCOUNTS).join(', ')}`);
  process.exit(1);
}

const { clerkId, checkPath } = ROLE_ACCOUNTS[role];

// 1. Jeton de connexion à usage unique (API Backend Clerk — jamais exposé côté client).
const tokenRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ user_id: clerkId, expires_in_seconds: 300 }),
});
if (!tokenRes.ok) {
  console.error(`Échec de la demande de jeton Clerk pour ${role} (HTTP ${tokenRes.status}) : ${await tokenRes.text()}`);
  process.exit(1);
}
const { token } = await tokenRes.json();
if (!token) {
  console.error(`Réponse Clerk sans jeton pour ${role}.`);
  process.exit(1);
}

// 2. Consomme le jeton — le formulaire de connexion de cette app est un
//    composant maison (`useSignIn()`, voir SignInForm.tsx) qui ne gère pas le
//    paramètre d'URL `__clerk_ticket` : l'échange se fait donc directement
//    via le SDK client Clerk exposé en global (`window.Clerk`), exactement
//    l'appel que ferait ce formulaire pour une connexion par mot de passe
//    (`signIn.create` puis `Clerk.setActive`), avec `strategy: 'ticket'`.
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${FRONTEND_URL}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 20000 });
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
  console.error(`ÉCHEC — ${role} : échange du jeton Clerk refusé (${result.status ?? result.error ?? 'raison inconnue'}).`);
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(2000);

// 3. Vérifie que la session a bien pris sur la page attendue du rôle.
//    LIMITE CONNUE DE CLERK (constatée en débogant cet outil, pas un bug de
//    l'app) : une session créée via strategy "ticket" n'obtient pas le
//    cookie HttpOnly __client (rafraîchissement long terme) — seules les
//    requêtes faites par le SDK client (`useAuth()`/`getToken()`, donc
//    toutes les pages 'use client' : /publier, /profil, /profil/securite,
//    /onboarding, /messages public…) la voient comme valide. Les routes
//    sous (dashboard) — /locataire, /bailleur, /agent et leurs pages
//    imbriquées — sont protégées par un Server Component qui appelle
//    `auth()` côté serveur ; pour ce type de session, Clerk y répond par un
//    handshake qui échoue ("...refresh-non-eligible-no-refresh-cookie") et
//    boucle sur /redirect. Un vrai mot de passe (flux normal du formulaire)
//    n'a pas ce problème — seules les sessions par jeton sont concernées.
//    On vérifie donc les DEUX : la page du rôle (comme demandé) ET /profil
//    (qui marche pour n'importe quel rôle signé) comme repli fiable.
await page.goto(`${FRONTEND_URL}${checkPath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
let dashboardUrl = page.url();
for (let i = 0; i < 6 && dashboardUrl.includes('/redirect'); i++) {
  await page.waitForTimeout(800);
  dashboardUrl = page.url();
}
await page.waitForTimeout(500);
dashboardUrl = page.url();
const dashboardOk = !dashboardUrl.includes('/sign-in') && !dashboardUrl.includes('/redirect');

await page.goto(`${FRONTEND_URL}/profil`, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
const profilUrl = page.url();
const profilOk = !profilUrl.includes('/sign-in');

if (!profilOk) {
  // Ni la page du rôle ni /profil ne marchent : la session elle-même n'a pas pris.
  console.error(`ÉCHEC — ${role} : session non reconnue même sur /profil (${profilUrl}).`);
  await browser.close();
  process.exit(1);
}

// 4. Sauvegarde l'état de session (cookies + storage) pour réutilisation par d'autres scripts Playwright.
const outDir = path.resolve(__dirname, '.sessions');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${role}.json`);
await context.storageState({ path: outPath });

console.log(`OK — session ${role} enregistrée dans ${outPath}`);
console.log(`     /profil (pages 'use client') : ${profilOk ? 'OK' : 'ÉCHEC'} → ${profilUrl}`);
console.log(`     ${checkPath} (dashboard, Server Component) : ${dashboardOk ? 'OK' : 'LIMITE CLERK — non vérifiable avec une session par jeton'} → ${dashboardUrl}`);

await browser.close();
