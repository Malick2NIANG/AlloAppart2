#!/usr/bin/env node
// Orchestrateur des opérations sur les données de démo (PLAN_CAPTURE.md § 7).
// N'exécute jamais rien contre la base de développement : la DATABASE_URL de
// la base de démo est construite ici et passée explicitement au Backend.
//
// Sous-commandes :
//   node scripts/demo.mjs seed [--finish-v3]   — lance Backend/prisma/seed.demo.ts
//   node scripts/demo.mjs clean                — lance Backend/scripts/demo-clean.ts
//
// Bascule du backend (démarrage sur la base de démo, port 4000, sans SMTP/
// Twilio/OneSignal) : voir capture/README.md — non automatisée ici
// (dépend de la façon dont chacun lance son Backend localement).

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '../../../Backend');
const DEMO_DATABASE_URL = 'postgresql://allo:allo_secret@localhost:5433/allo_appart_demo';

const [, , cmd, ...rest] = process.argv;

function runTsNode(scriptRelPath, extraArgs = []) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', scriptRelPath, ...extraArgs],
    {
      cwd: BACKEND_DIR,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: DEMO_DATABASE_URL },
    },
  );
  process.exit(result.status ?? 1);
}

switch (cmd) {
  case 'seed':
    runTsNode('prisma/seed.demo.ts', rest);
    break;
  case 'clean':
    runTsNode('scripts/demo-clean.ts', rest);
    break;
  default:
    console.error('Usage: node scripts/demo.mjs <seed|clean> [--finish-v3]');
    process.exit(1);
}
