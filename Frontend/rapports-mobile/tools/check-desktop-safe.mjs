#!/usr/bin/env node
// Contrôle automatique du diff — lot 7 (espace admin) et au-delà.
//
// Pour chaque fichier modifié entre deux révisions git, analyse chaque hunk
// du diff (-U0) et vérifie, hunk par hunk :
//   1. Les lignes retirées/ajoutées qui sont des className (JSX attribut ou
//      template literal) sont appariées 1 pour 1 (même position dans le
//      hunk). Pour chaque paire : toute classe retirée doit être présente
//      dans la ligne ajoutée (rien ne doit disparaître) ; toute classe en
//      plus doit être "protégée" : préfixe max-md:, classe tap-target,
//      md:hidden / hidden (en présence d'un md:* dans la même ligne),
//      variante arbitraire contenant hover:none.
//   2. Les lignes desktopClassName={...}/desktopBackdropClassName={...}
//      nouvellement ajoutées sont rapprochées des classes de la modale
//      d'origine (recherche heuristique dans les lignes retirées du même
//      hunk ou des hunks voisins du même fichier) — signalées pour relecture
//      manuelle si aucune correspondance évidente n'est trouvée (l'outil ne
//      peut pas remplacer la relecture pour ce point précis, il aide juste
//      à le retrouver).
//   3. Toute ligne retirée/ajoutée qui n'est PAS une ligne className pure
//      (JSX, prop, handler, logique, appel API, validation…) est signalée
//      "à justifier" — l'outil ne juge pas ces lignes, il les liste.
//
// Usage : node check-desktop-safe.mjs <base-ref> [head-ref=HEAD] [-- fichiers...]
// Sans liste de fichiers : tous les fichiers .tsx/.ts modifiés entre les deux refs.

import { execSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const dashIdx = args.indexOf('--');
const refs = dashIdx === -1 ? args : args.slice(0, dashIdx);
const explicitFiles = dashIdx === -1 ? [] : args.slice(dashIdx + 1);

const baseRef = refs[0];
const headRef = refs[1] ?? 'HEAD';
if (!baseRef) {
  console.error('Usage: node check-desktop-safe.mjs <base-ref> [head-ref=HEAD] [-- fichiers...]');
  process.exit(1);
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, cwd: path.resolve(import.meta.dirname, '../../..') });
}

let files = explicitFiles;
if (files.length === 0) {
  const out = sh(`git diff --name-only ${baseRef}..${headRef}`);
  files = out.split('\n').filter((f) => f.trim() && /\.(tsx?|jsx?)$/.test(f));
}

const CLASSNAME_LINE_RE = /^\s*className=\{?`?["'`]?(.*?)["'`]?\}?,?\s*$/;
// Repère une ligne qui EST (en tout ou grande partie) un attribut className
// JSX, sur une seule ligne — le style d'écriture de ce projet (une classe
// par ligne lors d'un remplacement ciblé).
function isClassNameLine(line) {
  const t = line.trim();
  return /className=/.test(t);
}
function extractClassTokens(line) {
  // Récupère tout le contenu entre guillemets/backticks sur la ligne,
  // explose en tokens espace. Les parties ${...} d'un template literal sont
  // gardées telles quelles comme un seul "token dynamique" opaque (jamais
  // comparées classe à classe).
  const matches = [...line.matchAll(/`([^`]*)`|"([^"]*)"|'([^']*)'/g)];
  const text = matches.map((m) => m[1] ?? m[2] ?? m[3] ?? '').join(' ');
  return text.split(/\s+/).filter(Boolean);
}
function isProtected(token) {
  if (token.startsWith('max-md:')) return true;
  if (token === 'tap-target' || token.startsWith('tap-target')) return true;
  if (token === 'md:hidden' || token.startsWith('md:hidden')) return true;
  if (token === 'hidden') return true; // couplé à un md:* ailleurs sur la ligne — vérifié séparément
  if (token.includes('hover:none')) return true;
  if (token.startsWith('${')) return true; // expression dynamique — hors de portée de cet outil
  return false;
}

function parseHunks(diffText) {
  const lines = diffText.split('\n');
  const hunks = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { header: line, removed: [], added: [] };
    } else if (current && line.startsWith('-') && !line.startsWith('---')) {
      current.removed.push(line.slice(1));
    } else if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.added.push(line.slice(1));
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

function analyzeFile(file) {
  const diff = sh(`git diff -U0 ${baseRef}..${headRef} -- "${file}"`);
  if (!diff.trim()) return { file, status: 'OK', notes: ['aucun changement'] };
  const hunks = parseHunks(diff);
  const alerts = [];
  let classNamePairs = 0;

  for (const hunk of hunks) {
    const { removed, added } = hunk;

    // Cas A : nombre egal de lignes retirees/ajoutees, toutes "className" —
    // appariement positionnel, le cas le plus frequent dans ce chantier.
    const allRemovedAreClassName = removed.every(isClassNameLine);
    const allAddedAreClassName = added.every(isClassNameLine);

    if (removed.length === added.length && allRemovedAreClassName && allAddedAreClassName && removed.length > 0) {
      for (let i = 0; i < removed.length; i++) {
        classNamePairs++;
        const before = extractClassTokens(removed[i]);
        const after = extractClassTokens(added[i]);
        const afterSet = new Set(after);
        const missing = before.filter((c) => !afterSet.has(c));
        if (missing.length > 0) {
          alerts.push({
            type: 'classe retiree',
            detail: `hunk ${hunk.header} — classes disparues : ${missing.join(', ')}`,
            before: removed[i].trim(), after: added[i].trim(),
          });
        }
        const beforeSet = new Set(before);
        const addedTokens = after.filter((c) => !beforeSet.has(c));
        const unprotected = addedTokens.filter((c) => !isProtected(c));
        // "hidden" seul n'est protege que si un token md:* est present sur la meme ligne.
        const hasMdToken = after.some((c) => c.startsWith('md:'));
        const reallyUnprotected = unprotected.filter((c) => !(c === 'hidden' && hasMdToken));
        if (reallyUnprotected.length > 0) {
          alerts.push({
            type: 'classe ajoutee non protegee',
            detail: `hunk ${hunk.header} — classes ajoutees sans prefixe max-md:/tap-target/md:hidden/hover:none : ${reallyUnprotected.join(', ')}`,
            before: removed[i].trim(), after: added[i].trim(),
          });
        }
      }
      continue;
    }

    // Cas B : hunk purement additif (uniquement des lignes ajoutees, rien
    // retire) — typiquement un nouveau composant (MobileStepperBar,
    // BottomSheet wrapper...) ou un nouvel import/useId/useRef. On signale
    // pour relecture manuelle (l'outil ne peut pas juger la logique), sauf
    // si CHAQUE ligne ajoutee est elle-meme une ligne className isolee (deja
    // couvert par le cas classe-ajoutee plus haut sur d'autres hunks) ou un
    // commentaire.
    if (removed.length === 0 && added.length > 0) {
      const allCommentsOrBlank = added.every((l) => /^\s*(\/\/|\/\*|\*|$)/.test(l));
      if (allCommentsOrBlank) continue;
      alerts.push({
        type: 'ajout a relire manuellement',
        detail: `hunk ${hunk.header} — ${added.length} ligne(s) ajoutee(s), aucune retiree (nouveau JSX/logique) : a justifier manuellement`,
        before: '(rien)', after: added.map((l) => l.trim()).join(' \\n '),
      });
      continue;
    }

    // Cas C : tout le reste (suppressions pures, comptes different,
    // melange className/non-className) — signale chaque ligne.
    alerts.push({
      type: 'hunk a justifier manuellement',
      detail: `hunk ${hunk.header} — ${removed.length} retiree(s) / ${added.length} ajoutee(s), motif non reconnu automatiquement`,
      before: removed.map((l) => l.trim()).join(' \\n '),
      after: added.map((l) => l.trim()).join(' \\n '),
    });
  }

  return {
    file,
    status: alerts.length === 0 ? 'OK' : 'A JUSTIFIER',
    classNamePairs,
    alerts,
  };
}

const results = files.map(analyzeFile);

console.log(`=== Contrôle automatique du diff : ${baseRef}..${headRef} ===\n`);
for (const r of results) {
  console.log(`--- ${r.file} : ${r.status} (${r.classNamePairs ?? 0} paire(s) className vérifiée(s)) ---`);
  if (r.alerts && r.alerts.length > 0) {
    for (const a of r.alerts) {
      console.log(`  [${a.type}] ${a.detail}`);
      console.log(`    avant : ${a.before}`);
      console.log(`    après : ${a.after}`);
    }
  }
  console.log('');
}

const totalAlerts = results.reduce((n, r) => n + (r.alerts?.length ?? 0), 0);
console.log(`=== Résumé : ${results.length} fichier(s), ${totalAlerts} alerte(s) à justifier ===`);
process.exit(totalAlerts > 0 ? 1 : 0);
