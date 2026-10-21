#!/usr/bin/env node
// Provisionne (ou rafraîchit) 4 comptes de test Clerk pour les espaces
// connectés — instance de DÉVELOPPEMENT uniquement (vérifie sk_test_*,
// refuse sinon). Adresses synthétiques `+clerk_test@example.com` (aucune
// personne réelle, jamais d'e-mail envoyé). Idempotent : si un compte existe
// déjà, son mot de passe est régénéré plutôt que d'en recréer un autre.
//
// Les mots de passe sont écrits UNIQUEMENT dans .credentials.env (gitignoré),
// jamais affichés en sortie, jamais commités.
//
// Usage : node provision-test-accounts.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, '../../../Backend/.env'));

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!SECRET_KEY) throw new Error('CLERK_SECRET_KEY absente de Backend/.env.');
if (!SECRET_KEY.startsWith('sk_test_')) throw new Error('CLERK_SECRET_KEY non-test (sk_test_) — abandon par sécurité.');

// Clé du rôle (alignée avec l'enum Prisma Role et les clerkId de clerk-session.mjs)
// -> slug utilisé dans l'adresse e-mail synthétique.
const ROLE_SLUGS = {
  LOCATAIRE: 'locataire',
  BAILLEUR: 'bailleur',
  PRO_AGENCE: 'agence',
  AGENT_TERRAIN: 'agent',
};

function genPassword() {
  // 24 caractères aléatoires + garantie de respecter la politique Clerk
  // (maj/min/chiffre/symbole) sans dépendre du hasard de randomBytes.
  const random = crypto.randomBytes(18).toString('base64').replace(/[+/=]/g, 'x');
  return `${random}Aa1!`;
}

async function clerkFetch(pathSuffix, opts = {}) {
  const res = await fetch(`https://api.clerk.com/v1${pathSuffix}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Clerk API ${pathSuffix} -> HTTP ${res.status} : ${await res.text()}`);
  }
  return res.json();
}

const accounts = {};
for (const [role, slug] of Object.entries(ROLE_SLUGS)) {
  const email = `aa-test-${slug}+clerk_test@example.com`;
  const password = genPassword();

  const existing = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}`);
  let clerkId;
  if (Array.isArray(existing) && existing.length > 0) {
    clerkId = existing[0].id;
    await clerkFetch(`/users/${clerkId}`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
  } else {
    const created = await clerkFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [email],
        password,
        first_name: 'Test',
        last_name: role,
      }),
    });
    clerkId = created.id;
  }
  accounts[role] = { email, password, clerkId };
}

const outPath = path.resolve(__dirname, '.credentials.env');
const lines = Object.entries(accounts).flatMap(([role, a]) => [
  `AA_TEST_${role}_EMAIL=${a.email}`,
  `AA_TEST_${role}_PASSWORD=${a.password}`,
  `AA_TEST_${role}_CLERK_ID=${a.clerkId}`,
]);
fs.writeFileSync(outPath, lines.join('\n') + '\n', { mode: 0o600 });

console.log(`OK — 4 comptes de test provisionnés/rafraîchis (mots de passe dans ${outPath}, non affichés).`);
for (const [role, a] of Object.entries(accounts)) {
  console.log(`  ${role}: ${a.email} (clerkId=${a.clerkId})`);
}
