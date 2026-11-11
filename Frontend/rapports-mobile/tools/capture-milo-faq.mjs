// Lot « Milo FAQ » — captures de contrôle (390/768/1440) : carte FAQ sur
// les 4 surfaces (accueil, /listings, header PC, feuille mobile), repli
// (recherche classique), chargement (spinner avant résolution). Jamais
// commité (outil de vérification ponctuel, comme capture-gabarits.mjs).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { FRONTEND_URL } from './clerk-session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../captures/milo-faq');
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

  if (vp.w >= 768) {
    // ── Header PC : la barre Localité elle-même passe par Milo ──────────
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'load', timeout: 30000 });
    await dismissCookies(page);
    await page.getByPlaceholder('Localité').fill('abonnement');
    await page.getByPlaceholder('Localité').press('Enter');
    await shot(page, 'header-chargement', vp.w);
    await shot(page, 'header-carte-faq', vp.w);

    // ── Accueil (hero) : carte FAQ dédiée ────────────────────────────────
    await page.reload({ waitUntil: 'load' });
    await dismissCookies(page);
    const heroInput = page.getByRole('textbox', { name: 'Décrivez votre recherche en une phrase' }).first();
    await heroInput.fill('comment ca marche');
    await heroInput.press('Enter');
    await shot(page, 'hero-carte-faq', vp.w);
    await page.getByText(/Lancer une recherche à la place/i).first().click().catch(() => {});
    await page.waitForURL(/\/listings\?/, { timeout: 8000 }).catch(() => {});
    await dismissCookies(page);
    await shot(page, 'hero-repli-recherche', vp.w);

    // ── /listings : bouton « Demander à Milo » (toggle compact) ─────────
    await page.goto(`${FRONTEND_URL}/listings`, { waitUntil: 'load', timeout: 30000 });
    await dismissCookies(page);
    await page.getByRole('button', { name: /demander à milo/i }).first().click();
    const listingsInput = page.getByRole('search').first().getByRole('textbox');
    await listingsInput.fill('devenir bailleur');
    await listingsInput.press('Enter');
    await shot(page, 'listings-carte-faq', vp.w);
  } else {
    // ── Mobile : loupe du header → feuille Milo ─────────────────────────
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'load', timeout: 30000 });
    await dismissCookies(page);
    await page.locator('button[aria-label="Rechercher"]').click();
    await page.waitForTimeout(300);
    const sheetInput = page.getByRole('textbox').first();
    await sheetInput.fill('contact');
    await sheetInput.press('Enter');
    await shot(page, 'mobile-sheet-carte-faq', vp.w);
  }

  await ctx.close();
}

await browser.close();
console.log(`Captures écrites dans ${OUT_DIR}`);
