import type { Page } from '@playwright/test';

/**
 * Attente « prêt » avant d'enregistrer un segment (PLAN_CAPTURE.md § 5) :
 * réseau inactif, plus aucun squelette `.animate-pulse`, images chargées,
 * polices prêtes. Les temps morts restants sont coupés au montage
 * (marks.json), pas ici.
 */
export async function waitUntilReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 15_000 }).catch(() => {});
  await page.waitForFunction(() => document.fonts.ready.then(() => true), { timeout: 10_000 }).catch(() => {});
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      }))),
    );
  });
}

/** Pose le consentement cookies (état réel d'un visiteur qui l'a acquitté) + thème sombre + langue fr. */
export async function primeBrowserState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('aa_cookie_consent', '1');
    } catch { /* stockage indisponible — non bloquant */ }
  });
  await page.context().addCookies([
    { name: 'allo-theme', value: 'dark', domain: 'localhost', path: '/' },
    { name: 'allo-locale', value: 'fr', domain: 'localhost', path: '/' },
  ]);
}

/** Échoue la capture si une erreur console/page ou un panneau d'erreur Next.js apparaît (§ 5 — ne jamais filmer par-dessus). */
export function failOnPageError(page: Page): void {
  page.on('pageerror', (err) => { throw new Error(`Erreur page détectée pendant la capture : ${err.message}`); });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // "Development mode" Clerk, warnings LCP et HMR sont tolérés — seules
      // les vraies erreurs (préfixe explicite) bloquent la capture.
      const text = msg.text();
      if (/Clerk has been loaded with development keys/.test(text)) return;
      if (/Largest Contentful Paint/.test(text)) return;
      throw new Error(`Erreur console détectée pendant la capture : ${text}`);
    }
  });
}

/** Bloque toute navigation/requête vers PayDunya (filet de sécurité § 5). */
export async function blockPayDunya(page: Page): Promise<void> {
  await page.route('**/*paydunya*', (route) => route.abort());
}

/** Vérifie l'absence du mode démo (`aa_demo_role`) avant de continuer (§ 5). */
export async function assertNoDemoRoleFlag(page: Page): Promise<void> {
  const flag = await page.evaluate(() => window.localStorage.getItem('aa_demo_role'));
  if (flag) throw new Error('aa_demo_role présent dans le stockage local — capture annulée (mode démo interdit).');
}
