// Lot « loupe du header » — captures de contrôle (390/768/1440) : header
// PC fermé/ouvert (saisie en cours), résultat (/listings via Milo), loupe
// mobile fermée/ouverte (feuille MiloSearchBar). Jamais commité (outil de
// vérification ponctuel, comme capture-gabarits.mjs).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { FRONTEND_URL } from './clerk-session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../captures/header-milo');
fs.mkdirSync(OUT_DIR, { recursive: true });

const WIDTHS = [{ w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }];

async function dismissCookies(page) {
  await page.getByRole('button', { name: /j'ai compris|accept/i }).click({ timeout: 2000 }).catch(() => {});
}

async function shot(page, name, w) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}-${w}.png`) });
  console.log(`OK ${name}@${w}`);
}

const browser = await chromium.launch();

for (const vp of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'load', timeout: 30000 });
  await dismissCookies(page);

  // Header fermé (état par défaut).
  await shot(page, 'header-ferme', vp.w);

  if (vp.w >= 768) {
    // PC : la barre reste la même, on tape une phrase (ouvert = en saisie).
    await page.getByPlaceholder('Localité').fill('studio meuble a dakar');
    await shot(page, 'header-ouvert', vp.w);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/listings\?/, { timeout: 8000 }).catch(() => {});
    await dismissCookies(page);
    await shot(page, 'header-resultat', vp.w);
  } else {
    // Mobile : la loupe ouvre la feuille Milo.
    await page.locator('button[aria-label="Rechercher"]').click();
    await page.waitForTimeout(300);
    await shot(page, 'header-ouvert', vp.w);
    await page.getByRole('textbox').first().fill('studio meuble a dakar');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/listings\?/, { timeout: 8000 }).catch(() => {});
    await dismissCookies(page);
    await shot(page, 'header-resultat', vp.w);
  }

  await ctx.close();
}

await browser.close();
console.log(`Captures écrites dans ${OUT_DIR}`);
