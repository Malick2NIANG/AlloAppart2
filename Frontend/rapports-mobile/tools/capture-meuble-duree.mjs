// Lot meublé/durée — captures de contrôle (390/768/1440) : publication
// (étape meublé), édition d'une annonce ancienne (furnished=null), filtres
// PC + feuille mobile, carte d'annonce, détail. Jamais commité (outil de
// vérification ponctuel, comme capture-gabarits.mjs).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { openAs, FRONTEND_URL } from './clerk-session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../captures/meuble-duree');
fs.mkdirSync(OUT_DIR, { recursive: true });

const WIDTHS = [{ w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }];
const EDIT_LISTING_ID = 'a4c4b7be-a3e5-4493-a879-d0b0a67d9b93'; // furnished=null
const DETAIL_LISTING_ID = 'b10922c2-adc1-46ea-827d-2f6c3d4539cc'; // furnished=true

async function dismissCookies(page) {
  await page.getByRole('button', { name: /j'ai compris|accept/i }).click({ timeout: 2000 }).catch(() => {});
}

async function shot(page, name, w) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}-${w}.png`), fullPage: false });
  console.log(`OK ${name}@${w}`);
}

// ── 1. Publication : étape meublé (APPARTEMENT + LOCATION, défauts) ──────
for (const vp of WIDTHS) {
  const { page, close } = await openAs('BAILLEUR', { viewport: { width: vp.w, height: vp.h }, locale: 'fr-FR' });
  await page.goto(`${FRONTEND_URL}/publier`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(600);

  // .last() : le Navbar porte lui-même un <form> (filtre prix Min/Max) rendu
  // avant le formulaire de publication dans le DOM — jamais celui qu'on veut.
  const form = page.locator('form').last();
  await form.getByPlaceholder(/Appartement 3 pièces meublé/i).fill('Capture QA — Appartement meublé lot');
  await form.locator('textarea').fill('Annonce de capture QA pour le lot meublé/durée, non destinée à la réservation.');
  await form.getByRole('button', { name: /suivant|next/i }).click();
  await page.waitForTimeout(400);

  await form.locator('input[type="number"]').first().fill('85');
  await form.getByRole('button', { name: /suivant|next/i }).click();
  await page.waitForTimeout(400);

  await form.locator('select').first().selectOption('Dakar');
  await form.getByPlaceholder(/Plateau, Dakar|Ex : Dakar/i).fill('Dakar');
  await form.getByPlaceholder(/Rue, numéro/i).fill('Rue test QA, Dakar');
  await form.getByRole('button', { name: /suivant|next/i }).click();
  await page.waitForTimeout(500);

  await dismissCookies(page);
  // Les cartes Meublé/Non meublé sont en tête d'étape — les faire défiler
  // avec une marge pour ne pas rester sous le Navbar sticky.
  await form.getByText('Meublé', { exact: true }).scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() => window.scrollBy(0, -120));
  await shot(page, 'publier-etape-meuble', vp.w);
  await close();
}

// ── 2. Édition d'une annonce ancienne (furnished=null) ────────────────────
for (const vp of WIDTHS) {
  const { page, close } = await openAs('BAILLEUR', { viewport: { width: vp.w, height: vp.h }, locale: 'fr-FR' });
  await page.goto(`${FRONTEND_URL}/bailleur/listings/${EDIT_LISTING_ID}/edit`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(800);
  // Avance jusqu'à l'étape meublé (même index qu'en publication : 3).
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /suivant|next/i }).click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await dismissCookies(page);
  await page.getByText('Non précisé', { exact: true }).scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() => window.scrollBy(0, -120));
  await shot(page, 'edition-annonce-ancienne', vp.w);
  await close();
}

// ── 3/4/5. Filtres (PC + mobile), carte, détail — public, sans auth ──────
const browser = await chromium.launch();
for (const vp of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'fr-FR' });
  const page = await ctx.newPage();

  // Carte d'annonce (grille /listings).
  await page.goto(`${FRONTEND_URL}/listings`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(600);
  await dismissCookies(page);
  await shot(page, 'carte-annonce', vp.w);

  // Panneau filtres PC (>=768) ou feuille mobile (<768).
  if (vp.w >= 768) {
    await page.getByRole('button', { name: /filtres|filters/i }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, 'filtres-pc-panel', vp.w);
  } else {
    await page.getByRole('button', { name: /filtres|filters/i }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    // Nuitée/Ameublement/Prix sont plus bas dans le tiroir (après Transaction/
    // Type de bien/Région) — molette dans le tiroir pour les amener dans le cadre.
    await page.mouse.move(vp.w / 2, vp.h / 2);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(300);
    await shot(page, 'filtres-mobile-sheet', vp.w);
  }

  // Détail d'une annonce meublée.
  await page.goto(`${FRONTEND_URL}/listings/${DETAIL_LISTING_ID}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(600);
  await dismissCookies(page);
  await shot(page, 'detail-annonce', vp.w);

  await ctx.close();
}
await browser.close();

console.log(`Captures écrites dans ${OUT_DIR}`);
