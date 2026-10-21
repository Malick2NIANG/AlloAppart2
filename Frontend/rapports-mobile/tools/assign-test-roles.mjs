#!/usr/bin/env node
// Attribue les rôles LOCATAIRE/BAILLEUR/PRO_AGENCE/AGENT_TERRAIN aux 4 comptes
// de test provisionnés par provision-test-accounts.mjs — UNIQUEMENT ces 4
// lignes (filtrées par "clerkId" exact, jamais par un critère large), aucun
// ADMIN. Les lignes doivent déjà exister en base : visite au moins une page
// avec openAs(role) avant d'exécuter ce script (le premier appel backend
// authentifié crée la ligne automatiquement, rôle LOCATAIRE par défaut —
// voir ClerkAuthGuard.canActivate).
//
// Usage : node assign-test-roles.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, '.credentials.env'));

const PG_CONTAINER = 'allo_postgres';
const PG_USER = 'allo';
const PG_DB = 'allo_appart';

function clerkIdOf(role) {
  const id = process.env[`AA_TEST_${role}_CLERK_ID`];
  if (!id) throw new Error(`clerkId manquant pour ${role} dans .credentials.env.`);
  return id;
}

function runSql(sql) {
  execFileSync('docker', ['exec', '-i', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'inherit' });
}

const locataireId = clerkIdOf('LOCATAIRE');
const bailleurId = clerkIdOf('BAILLEUR');
const agenceId = clerkIdOf('PRO_AGENCE');
const agentId = clerkIdOf('AGENT_TERRAIN');

console.log('— LOCATAIRE (déjà correct par défaut, juste les CGU) —');
runSql(`UPDATE users SET "termsAcceptedAt" = COALESCE("termsAcceptedAt", now()) WHERE "clerkId" = '${locataireId}';`);

console.log('— BAILLEUR —');
runSql(`UPDATE users SET roles = ARRAY['LOCATAIRE','BAILLEUR']::"Role"[], "bailleurTermsAcceptedAt" = now(), "termsAcceptedAt" = COALESCE("termsAcceptedAt", now()), phone = COALESCE(phone, '+221771234567') WHERE "clerkId" = '${bailleurId}';`);

console.log('— PRO_AGENCE —');
runSql(`UPDATE users SET roles = ARRAY['PRO_AGENCE']::"Role"[], "agencyName" = 'Agence Test AlloAppart', "agencySlug" = 'agence-test-alloappart', "bailleurTermsAcceptedAt" = now(), "termsAcceptedAt" = COALESCE("termsAcceptedAt", now()), phone = COALESCE(phone, '+221771234568') WHERE "clerkId" = '${agenceId}';`);

const subId = crypto.randomUUID();
runSql(`INSERT INTO subscriptions (id, "userId", plan, status, "monthlyFee", "updatedAt") SELECT '${subId}', id, 'PRO', 'ACTIVE', 0, now() FROM users WHERE "clerkId" = '${agenceId}' ON CONFLICT ("userId") DO UPDATE SET plan = 'PRO', status = 'ACTIVE', "updatedAt" = now();`);

console.log('— AGENT_TERRAIN —');
runSql(`UPDATE users SET roles = ARRAY['AGENT_TERRAIN']::"Role"[], "termsAcceptedAt" = COALESCE("termsAcceptedAt", now()), phone = COALESCE(phone, '+221771234569') WHERE "clerkId" = '${agentId}';`);

console.log('OK — rôles attribués pour les 4 comptes de test (et eux seuls).');
