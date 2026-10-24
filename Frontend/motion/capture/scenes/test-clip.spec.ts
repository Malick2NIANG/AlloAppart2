import fs from 'node:fs';
import path from 'node:path';
import { test, chromium } from '@playwright/test';
import { installCursor, moveCursorTo, tapAt, smoothScrollBy } from '../lib/cursor';
import { waitUntilReady, primeBrowserState, failOnPageError, blockPayDunya, assertNoDemoRoleFlag } from '../lib/wait';

// Clip de test (PROMPT 02) : la page Annonces en mobile — défilement puis
// ouverture d'une annonce. Visiteur (sans session), données de démo
// réelles (allo_appart_demo), rendu « mode application » sous 768px réel
// (barre du bas, feuilles du bas, PWA) — mise à jour de la consigne du
// prompt 02, filmé à 390×844.

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = path.resolve(__dirname, '../../captures/test/raw');
const MARKS_PATH = path.resolve(__dirname, '../../captures/test/marks.json');

test('clip de test — Annonces mobile (défilement + ouverture)', async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const marks: Record<string, number> = {};
  const t0 = Date.now();
  const mark = (label: string) => { marks[label] = Date.now() - t0; };

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    colorScheme: 'dark',
    recordVideo: { dir: OUT_DIR, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  failOnPageError(page);
  await blockPayDunya(page);
  await primeBrowserState(page);
  await installCursor(page);

  try {
    // ── Préchauffage : une première visite compile la route en dev ────────
    await page.goto(`${BASE_URL}/listings`, { waitUntil: 'networkidle' });
    await waitUntilReady(page);
    await assertNoDemoRoleFlag(page);

    // ── Prise réelle (la vidéo démarre à l'ouverture du contexte — le
    //    marks.json sert à couper le temps de chargement au montage) ──────
    await page.reload({ waitUntil: 'networkidle' });
    await waitUntilReady(page);
    mark('listings_ready');

    // Défilement progressif dans le catalogue.
    await smoothScrollBy(page, 500, 900);
    mark('scroll_done');
    await page.waitForTimeout(400);

    // Revenir en haut pour un cadrage net avant d'ouvrir la première annonce.
    await smoothScrollBy(page, -500, 600);
    await page.waitForTimeout(300);

    const firstCard = page.locator('a[href^="/listings/"]').first();
    const box = await firstCard.boundingBox();
    if (!box) throw new Error('Aucune carte d\'annonce trouvée sur /listings — vérifier le seed de démo.');
    const cx = box.x + box.width / 2;
    const cy = box.y + Math.min(box.height / 2, 300);
    await moveCursorTo(page, cx, cy, 195, 700);
    mark('before_tap');
    await tapAt(page, cx, cy);
    await page.waitForURL(/\/listings\/.+/, { timeout: 15_000 });
    await waitUntilReady(page);
    mark('listing_open');
    await page.waitForTimeout(500); // 0,5s d'image stable en fin de segment (règle du chantier)
    mark('end');
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  fs.writeFileSync(MARKS_PATH, JSON.stringify(marks, null, 2) + '\n');
  console.log('Marks écrits dans', MARKS_PATH);
  console.log(JSON.stringify(marks, null, 2));
});
