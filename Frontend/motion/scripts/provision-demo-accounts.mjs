#!/usr/bin/env node
// Provisionne (ou rafraîchit) les 8 comptes de démo Clerk du film de
// lancement — instance de DÉVELOPPEMENT uniquement (vérifie sk_test_*,
// refuse sinon). Adresses `demo-<rôle>+clerk_test@example.com` : en
// instance de développement Clerk, ce motif accepte le code de
// vérification fixe 424242 si une étape de code est présentée.
//
// Correction de connexion (voir PLAN_CAPTURE.md § 4, « Décisions validées
// — correction de connexion ») : les sessions par jeton Clerk ne
// fonctionnent pas sur les espaces connectés (rendu serveur). Chaque
// compte a donc un VRAI mot de passe généré (jamais skip_password_requirement),
// pour une connexion par le formulaire réel /sign-in.
//
// Les mots de passe et clerkId sont écrits UNIQUEMENT dans
// capture/.credentials.env (gitignoré), jamais affichés en sortie, jamais
// commités. Idempotent : si un compte existe déjà (recherche par e-mail),
// son mot de passe est régénéré plutôt que d'en recréer un autre.
//
// Usage : node scripts/provision-demo-accounts.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, '../../../Backend/.env'));

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!SECRET_KEY) throw new Error('CLERK_SECRET_KEY absente de Backend/.env.');
if (!SECRET_KEY.startsWith('sk_test_')) throw new Error('CLERK_SECRET_KEY non-test (sk_test_) — abandon par sécurité.');

// Clé de persona (alignée avec PLAN_DEMO.md § 1) -> { slug e-mail, prénom, nom affichés }.
const DEMO_PERSONAS = {
  'demo-locataire':   { firstName: 'Fatou',   lastName: 'Ndiaye'  },
  'demo-bailleur':     { firstName: 'Moussa',  lastName: 'Sarr'    },
  'demo-bailleur-2':   { firstName: 'Aminata', lastName: 'Diallo'  },
  'demo-agence':       { firstName: 'Ousmane', lastName: 'Ba'      },
  'demo-agent':        { firstName: 'Cheikh',  lastName: 'Mbaye'   },
  'demo-agent-2':      { firstName: 'Mariama', lastName: 'Sow'     },
  'demo-locataire-2':  { firstName: 'Ndeye',   lastName: 'Seck'    },
  'demo-locataire-3':  { firstName: 'Pape',    lastName: 'Gueye'   },
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
for (const [key, persona] of Object.entries(DEMO_PERSONAS)) {
  const email = `${key}+clerk_test@example.com`;
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
        first_name: persona.firstName,
        last_name: persona.lastName,
      }),
    });
    clerkId = created.id;
  }
  accounts[key] = { email, password, clerkId, ...persona };
}

const outDir = path.resolve(__dirname, '../capture');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, '.credentials.env');
const lines = Object.entries(accounts).flatMap(([key, a]) => {
  const envKey = key.toUpperCase().replace(/-/g, '_');
  return [
    `${envKey}_EMAIL=${a.email}`,
    `${envKey}_PASSWORD=${a.password}`,
    `${envKey}_CLERK_ID=${a.clerkId}`,
  ];
});
fs.writeFileSync(outPath, lines.join('\n') + '\n', { mode: 0o600 });

console.log(`OK — ${Object.keys(accounts).length} comptes de démo provisionnés/rafraîchis (mots de passe dans ${outPath}, non affichés).`);
for (const [key, a] of Object.entries(accounts)) {
  console.log(`  ${key}: ${a.email} (clerkId=${a.clerkId})`);
}
