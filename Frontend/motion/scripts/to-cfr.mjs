#!/usr/bin/env node
// Convertit une vidéo brute Playwright (webm, cadence variable) en 30 i/s
// constants — PLAN_CAPTURE.md § 2 : fps=30, mise à l'échelle Lanczos, H.264
// crf≈14, yuv420p, image clé toutes les 15 images, sans audio. Utilise le
// ffmpeg fourni par Remotion (`npx remotion ffmpeg`) — aucune installation
// de ffmpeg.
//
// Usage : node scripts/to-cfr.mjs <entrée.webm> <sortie.mp4>

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('Usage: node scripts/to-cfr.mjs <entrée.webm> <sortie.mp4>');
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`Fichier introuvable : ${input}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(output), { recursive: true });

const q = (s) => `"${s}"`;
// Le ffmpeg fourni par Remotion est une build minimale : le filtre `fps`
// (PLAN_CAPTURE.md § 2) n'y est pas compilé (`No option name near '30'`).
// `-r` (option de sortie, pas un filtre) fait la même duplication/
// suppression d'images au niveau du muxer — disponible dans ce build.
const cmd = [
  'npx', 'remotion', 'ffmpeg',
  '-y',
  '-i', q(input),
  '-r', '30',
  '-c:v', 'libx264',
  '-crf', '14',
  '-pix_fmt', 'yuv420p',
  '-g', '15',
  '-an',
  q(output),
].join(' ');

const result = spawnSync(cmd, {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
