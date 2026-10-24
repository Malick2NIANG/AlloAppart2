#!/usr/bin/env node
// Télécharge une fois les photos listées dans demo/photos/credits.json
// (CDN Pexels) et les renvoie vers Cloudinary, dossier dédié
// `allo-appart/demo/` + étiquette `demo` (PLAN_DEMO.md § 3
// « Hébergement » — supprimable d'un coup, cohérent avec `res.cloudinary.com`
// déjà autorisé dans Frontend/next.config.ts, contrairement à
// images.pexels.com qui n'y figure pas et ne doit jamais y être ajouté
// sans accord explicite).
//
// Écrit l'URL Cloudinary obtenue dans credits.json (champ `cloudinaryUrl`,
// à côté de `cdnUrl` qui reste la source d'origine pour l'attribution).
// Idempotent : une photo qui a déjà un `cloudinaryUrl` n'est pas re-uploadée.
//
// Usage : node scripts/upload-demo-photos.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, '../../../Backend/.env'));

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  throw new Error('CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET absents de Backend/.env.');
}

const creditsPath = path.resolve(__dirname, '../demo/photos/credits.json');
const credits = JSON.parse(fs.readFileSync(creditsPath, 'utf8'));

function signParams(params) {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(sorted + API_SECRET).digest('hex');
}

async function uploadFromUrl(sourceUrl, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { folder: 'allo-appart/demo', public_id: publicId, tags: 'demo', timestamp };
  const signature = signParams(paramsToSign);

  const form = new FormData();
  form.append('file', sourceUrl);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', paramsToSign.folder);
  form.append('public_id', publicId);
  form.append('tags', paramsToSign.tags);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Cloudinary upload -> HTTP ${res.status} : ${await res.text()}`);
  }
  const json = await res.json();
  return json.secure_url;
}

let uploaded = 0;
let skipped = 0;
for (const photo of credits.photos) {
  if (photo.cloudinaryUrl) { skipped++; continue; }
  const publicId = `${photo.listingKey}-${photo.order}`;
  const secureUrl = await uploadFromUrl(photo.cdnUrl, publicId);
  photo.cloudinaryUrl = secureUrl;
  uploaded++;
  console.log(`  OK  ${photo.listingKey} #${photo.order} -> ${secureUrl}`);
}

fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n');
console.log(`\n${uploaded} photo(s) envoyée(s) sur Cloudinary, ${skipped} déjà présente(s). credits.json mis à jour.`);
