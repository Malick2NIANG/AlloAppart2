#!/usr/bin/env node
// Outil CLI : connexion Playwright via jeton Clerk (sign_in_token), vérifie
// la session obtenue, puis l'enregistre dans .sessions/<rôle>.json pour
// inspection manuelle (gitignoré). La logique de connexion elle-même vit
// dans clerk-session.mjs (openAs), réutilisable directement par d'autres
// scripts sans passer par un fichier de session enregistré.
//
// Usage : node login-as.mjs <LOCATAIRE|BAILLEUR|PRO_AGENCE|AGENT_TERRAIN>

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { openAs, ROLE_ACCOUNTS, FRONTEND_URL } from './clerk-session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const role = process.argv[2];
if (!role || !ROLE_ACCOUNTS[role]) {
  console.error(`Rôle manquant ou inconnu. Rôles disponibles : ${Object.keys(ROLE_ACCOUNTS).join(', ')}`);
  process.exit(1);
}

let session;
try {
  session = await openAs(role);
} catch (err) {
  console.error(`ÉCHEC — ${role} : ${err.message}`);
  process.exit(1);
}
const { context, page, checkPath } = session;

// Vérifie que la session a bien pris, sur les DEUX fronts : la page du rôle
// (dashboard, Server Component) ET /profil (pages 'use client', repli
// fiable). Voir le commentaire de clerk-session.mjs pour la limite Clerk
// connue sur les routes (dashboard).
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
  console.error(`ÉCHEC — ${role} : session non reconnue même sur /profil (${profilUrl}).`);
  await session.close();
  process.exit(1);
}

const outDir = path.resolve(__dirname, '.sessions');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${role}.json`);
await context.storageState({ path: outPath });

console.log(`OK — session ${role} enregistrée dans ${outPath}`);
console.log(`     /profil (pages 'use client') : ${profilOk ? 'OK' : 'ÉCHEC'} → ${profilUrl}`);
console.log(`     ${checkPath} (dashboard, Server Component) : ${dashboardOk ? 'OK' : 'LIMITE CLERK — non vérifiable avec une session par jeton'} → ${dashboardUrl}`);

await session.close();
