// AlloAppart — E2E manual script (not run via `playwright test`, run via `node e2e/flow.mjs [stages...]`)
// Drives a real Chromium against http://localhost:3001 / http://localhost:4000/api/v1
// and logs progress + screenshots + console/network errors to e2e/screenshots and e2e/log.jsonl.

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, 'screenshots');
const LOG_FILE = path.join(__dirname, 'log.jsonl');
const STATE_FILE = path.join(__dirname, 'state.json');
fs.mkdirSync(SS_DIR, { recursive: true });

// Port 3001 occupé par un autre process (Luum) sur la machine de test — 3000
// utilisé à la place. Reste surchargeable au besoin sans retoucher le script.
const FRONTEND = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
const RUN_ID = process.env.E2E_RUN_ID || String(Date.now());

function getClerkSecretKey() {
  const envPath = path.join(__dirname, '..', '..', 'Backend', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^CLERK_SECRET_KEY=(.+)$/m);
  if (!match) throw new Error('CLERK_SECRET_KEY not found in Backend/.env');
  return match[1].trim();
}

// Sign-up's captcha (Cloudflare Turnstile) hangs indefinitely in this headless Chromium
// environment even with a Testing Token (server-side bypass only — client still tries to
// solve the widget). Decision taken with the user: create test users directly via Clerk's
// Backend API (server-to-server, no captcha involved) and exercise the real browser
// /sign-in form for everything downstream instead of /sign-up.
// Le rôle ADMIN n'est attribuable par aucun endpoint applicatif — voir
// Backend/ADMIN_RECOVERY.md, qui documente l'UPDATE SQL directe comme seul
// mécanisme prévu. Suppose que la stack docker compose de Code/docker-compose.yml
// (service "postgres", mêmes identifiants que DATABASE_URL dans Backend/.env)
// tourne déjà en local. clerkId vient de createClerkUser() (jamais d'entrée
// utilisateur), donc pas de risque d'injection SQL à l'interpoler ici.
function grantAdminRole(clerkId) {
  const repoRoot = path.join(__dirname, '..', '..');
  const sql = `UPDATE users SET roles = array_append(roles, 'ADMIN'::"Role") WHERE "clerkId" = '${clerkId}' AND NOT (roles @> ARRAY['ADMIN']::"Role"[]);`;
  // execFileSync passe chaque argument directement au process "docker" (pas de
  // ré-interprétation par un shell) — évite le bug d'échappement rencontré avec
  // execSync + une commande unique passée par cmd.exe sous Windows : les
  // guillemets doubles entourant "Role"/"clerkId" à l'intérieur d'un -c "..."
  // déjà entre guillemets étaient avalés par cmd.exe avant d'atteindre psql,
  // qui recevait alors clerkId/Role sans guillemets — Postgres les repliait
  // en minuscules (clerkid), colonne inexistante.
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'allo', '-d', 'allo_appart', '-c', sql],
    { cwd: repoRoot, stdio: 'inherit' },
  );
}

async function createClerkUser(user) {
  const res = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getClerkSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [user.email],
      password: user.password,
      first_name: user.firstName,
      last_name: user.lastName,
      skip_password_checks: true,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Failed to create Clerk user: HTTP ${res.status} — ${JSON.stringify(body)}`);
  return body;
}

// Clerk session hydration after a fresh page navigation occasionally races in headless
// Chromium — the page can render as if signed-out for a few seconds even though session
// cookies are present. Wait for a "ready" locator; reload once if it never appears.
// This sandboxed headless Chromium has intermittent DNS resolution failures for external
// domains (observed on both challenges.cloudflare.com and Clerk's own *.clerk.accounts.dev
// FAPI domain — net::ERR_NAME_NOT_RESOLVED). Reloading the page issues a fresh burst of
// external requests and empirically makes this *worse*, not better, so: wait patiently
// in place first: only reload as a last-resort, single attempt.
async function robustGoto(page, url, readyLocator, { patientTimeout = 30000, reloadTimeout = 20000 } = {}) {
  const tryWait = (timeout) => readyLocator(page).waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch((e) => { log('waitfor-error', 'warn', { msg: String(e?.message || e).slice(0, 400) }); return false; });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  let ready = await tryWait(patientTimeout);
  if (!ready) {
    log('robust-goto-stall', 'warn', { url, msg: 'not ready after patient wait, trying one reload' });
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    ready = await tryWait(reloadTimeout);
  }
  if (!ready) {
    await shot(page, 'robust-goto-FAILED');
    const bodyText = await page.locator('body').innerText().catch(() => '(unavailable)');
    log('robust-goto-failed-body', 'fail', { msg: bodyText.slice(0, 400) });
    throw new Error(`robustGoto: readyLocator never appeared at ${url}`);
  }
}

async function signIn(page, user, label) {
  await page.goto(`${FRONTEND}/sign-in`, { waitUntil: 'domcontentloaded' });
  await shot(page, `${label}-01-signin-page`);

  await page.getByPlaceholder('vous@exemple.com').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await shot(page, `${label}-02-signin-filled`);

  await page.getByRole('button', { name: 'Se connecter' }).click();
  // waitUntil par défaut de waitForURL est 'load' — sujet à une race condition connue
  // de Playwright : si l'événement 'load' de la navigation cible s'est déjà déclenché
  // avant cet appel (redirection /sign-in -> / très rapide), il n'y a plus de nouvel
  // événement 'load' à attendre et l'appel peut bloquer jusqu'au timeout, même si l'URL
  // est déjà correcte. domcontentloaded (déjà utilisé ailleurs dans ce script pour les
  // mêmes raisons) suffit ici : le networkidle qui suit sert de marge de sécurité.
  try {
    await page.waitForURL(`${FRONTEND}/`, { timeout: 15000, waitUntil: 'domcontentloaded' });
  } catch (err) {
    // Observé 2 fois sur des runs différents, à des stages différents à chaque
    // fois (jamais le même point du flux) — profil d'instabilité transitoire
    // cumulative (Clerk/serveur dev sous charge après de nombreuses connexions
    // dans le même run) plutôt qu'un bug de code localisé. Un seul nouvel essai
    // avant d'abandonner pour de bon, avec une capture diagnostique du 1er échec.
    await shot(page, `${label}-signin-TIMEOUT-retry`);
    log(`signin-retry:${label}`, 'warn', { url: page.url(), msg: String(err?.message || err).slice(0, 300) });
    if (page.url().startsWith(`${FRONTEND}/sign-in`)) {
      await page.getByRole('button', { name: 'Se connecter' }).click().catch(() => {});
    }
    await page.waitForURL(`${FRONTEND}/`, { timeout: 25000, waitUntil: 'domcontentloaded' });
  }
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await shot(page, `${label}-03-signin-complete`);
  log(`signin:${label}`, 'pass', { email: user.email });
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
const state = loadState();
state.runId = state.runId || RUN_ID;
saveState(state);

function log(step, status, extra = {}) {
  const entry = { t: new Date().toISOString(), step, status, ...extra };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  console.log(`[${entry.t}] ${status.toUpperCase()} — ${step}` + (extra.msg ? ` :: ${extra.msg}` : ''));
}

async function shot(page, name) {
  const file = path.join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

function attachDiagnostics(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      log(`console-error:${label}`, 'warn', { msg: msg.text().slice(0, 500) });
    }
  });
  page.on('pageerror', (err) => {
    log(`pageerror:${label}`, 'warn', { msg: String(err).slice(0, 500) });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      log(`http-error:${label}`, 'warn', { url: res.url(), status: res.status() });
    }
  });
}

const BAILLEUR = {
  firstName: 'Moussa',
  lastName: 'Diallo',
  email: `aa.bailleur.${RUN_ID}+clerk_test@example.com`,
  password: 'TestE2E-2026-Secure!',
};
const LOCATAIRE = {
  firstName: 'Awa',
  lastName: 'Ndiaye',
  email: `aa.locataire.${RUN_ID}+clerk_test@example.com`,
  password: 'TestE2E-2026-Secure!',
};
const ADMIN = {
  firstName: 'Fatou',
  lastName: 'Sarr',
  email: `aa.admin.${RUN_ID}+clerk_test@example.com`,
  password: 'TestE2E-2026-Secure!',
};

/* ───────────────────────── helpers ───────────────────────── */

async function becomeBailleur(page, phone) {
  await page.goto(`${FRONTEND}/become-bailleur`, { waitUntil: 'domcontentloaded' });

  // Clerk session hydration after a fresh sign-in can occasionally race with this page's
  // `getToken()` call in headless Chromium, leaving it stuck on its loading spinner
  // (`if (!token) return;` with no fallback). Reload once if still spinning after 8s.
  const phoneInputEarly = page.getByPlaceholder('+221 77 000 00 00');
  const checkboxEarly = page.getByRole('checkbox');
  const settled = await Promise.race([
    phoneInputEarly.waitFor({ state: 'visible', timeout: 8000 }).then(() => true),
    checkboxEarly.waitFor({ state: 'visible', timeout: 8000 }).then(() => true),
  ]).catch(() => false);
  if (!settled) {
    log('become-bailleur-stall', 'warn', { msg: 'reloading after spinner stall' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await Promise.race([
      phoneInputEarly.waitFor({ state: 'visible', timeout: 15000 }),
      checkboxEarly.waitFor({ state: 'visible', timeout: 15000 }),
    ]);
  }
  await shot(page, 'bailleur-05-become-bailleur-page');

  const phoneInput = page.getByPlaceholder('+221 77 000 00 00');
  if (await phoneInput.isVisible().catch(() => false)) {
    await phoneInput.fill(phone);
    await page.getByRole('button', { name: 'Continuer' }).click();
  }

  await page.getByRole('checkbox').check();
  await shot(page, 'bailleur-06-terms-accepted');
  await page.getByRole('button', { name: 'Activer mon espace bailleur' }).click();

  await page.waitForURL(/\/bailleur\/listings/, { timeout: 15000 });
  await shot(page, 'bailleur-07-activated');
  log('become-bailleur', 'pass');
}

async function publishListing(page, { title, price, city, address }) {
  await robustGoto(page, `${FRONTEND}/publier`, (p) => p.getByRole('button', { name: 'Appartement' }));
  await shot(page, 'listing-01-step0');

  // Step 0: type + title + description
  await page.getByRole('button', { name: 'Appartement' }).click();
  await page.getByPlaceholder('Ex : Appartement 3 pièces meublé au Plateau').fill(title);
  await page.getByPlaceholder('Décrivez votre bien en détail : luminosité, état, proximité services, transports…')
    .fill('Bel appartement lumineux, proche des commodités, idéal pour un test end-to-end automatisé.');
  await shot(page, 'listing-02-step0-filled');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 1: caractéristiques. BUG FOUND: these fields are optional in the Zod schema
  // (z.number().positive().optional()), but the inputs use react-hook-form's
  // { valueAsNumber: true }. An untouched <input type="number"> has DOM value "" ,
  // which valueAsNumber converts to NaN — and Zod's .optional() only accepts
  // `undefined`, not NaN, so validation fails silently (no error UI is wired for
  // these fields) and "Suivant" permanently no-ops. Filling them is a workaround,
  // but a real user leaving them blank would get stuck with no visible error.
  await shot(page, 'listing-03-step1');
  // Scoped to the form: the sticky header's search bar also has type="number" Min/Max
  // inputs earlier in DOM order, which an unscoped selector would hit instead.
  const numberInputs = page.locator('main input[type="number"]');
  await numberInputs.nth(0).fill('85'); // surface
  await numberInputs.nth(1).fill('3');  // rooms
  await numberInputs.nth(2).fill('2');  // beds
  await numberInputs.nth(3).fill('1');  // baths
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 2: localisation
  await shot(page, 'listing-04-step2');
  await page.locator('main select').first().selectOption('Dakar');
  await page.getByPlaceholder('Ex : Plateau, Dakar').fill(city);
  await page.getByPlaceholder('Rue, numéro, résidence…').fill(address);
  await shot(page, 'listing-05-step2-filled');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 3: mode de location (NUITÉE) + prix. Le formulaire défaut désormais
  // sur MENSUEL (cf. defaultValues du wizard) — sans ce clic explicite, les
  // champs qui s'affichent sont "Loyer mensuel"/"Caution"/"Durée minimale du
  // bail" (placeholder "Ex : 350 000" partagé avec l'ancien champ nuitée),
  // pas "Prix par nuit" ("Ex : 15 000") : "Caution" reste vide et obligatoire,
  // "Suivant" échoue silencieusement (validation Zod), et l'étape Photos
  // n'est jamais atteinte. Les réservations créées plus loin (book-1/book-2)
  // exigent une annonce en mode nuitée — ce clic n'est donc pas juste une
  // précaution de robustesse comme dans publishMonthlyListing(), il est requis.
  await shot(page, 'listing-06-step3');
  await page.getByRole('button', { name: 'Nuitée' }).click();
  await page.getByPlaceholder('Ex : 15 000').fill(String(price));
  await shot(page, 'listing-07-step3-filled');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 4: photos
  await shot(page, 'listing-08-step4');
  await uploadAndCropPhoto(page, path.join(__dirname, 'fixtures', 'test-listing.jpg'));
  await shot(page, 'listing-09-step4-uploaded');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 5: recap + publish
  await shot(page, 'listing-10-recap');

  const [createResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/v1/listings') && r.request().method() === 'POST', { timeout: 20000 }),
    page.getByRole('button', { name: 'Publier' }).click(),
  ]);

  const status = createResp.status();
  let body = null;
  try { body = await createResp.json(); } catch {}
  await shot(page, 'listing-11-after-submit');

  if (status >= 200 && status < 300) {
    log('publish-listing', 'pass', { listingId: body?.id, status: body?.status });
    return body;
  } else {
    log('publish-listing', 'fail', { status, body });
    throw new Error(`Listing creation failed: HTTP ${status} — ${JSON.stringify(body)}`);
  }
}

// Depuis l'ajout de PhotoCropper (compression + recadrage 4:3), chaque photo
// sélectionnée ouvre une modale de recadrage (canvas + slider zoom) avant
// d'être réellement envoyée à Cloudinary — c'est le clic sur "Confirmer" qui
// déclenche l'upload, pas la sélection du fichier elle-même. Sans ce clic, la
// modale reste ouverte indéfiniment ("Au moins une photo est requise" en
// arrière-plan) et son overlay plein écran (`fixed inset-0 bg-black/70`)
// bloque tout clic sur "Suivant".
async function uploadAndCropPhoto(page, filePath) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  await page.getByRole('button', { name: 'Confirmer' }).click();
  // Laisse le temps à l'upload Cloudinary (déclenché par la confirmation du
  // recadrage) de se terminer avant de continuer.
  await page.waitForTimeout(3000);
}

async function searchAndOpenListing(page, title) {
  await page.goto(`${FRONTEND}/listings?q=${encodeURIComponent(title)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, 'booking-01-search-results');

  const link = page.locator(`a:has-text("${title}")`).first();
  await link.waitFor({ state: 'visible', timeout: 10000 });
  await link.click();
  await page.waitForURL(/\/listings\/[a-f0-9-]+/, { timeout: 10000 });
  await shot(page, 'booking-02-listing-detail');
  log('search-listing', 'pass', { url: page.url() });
}

// Depuis le remplacement des <input type="date"> par un calendrier cliquable
// (AvailabilityCalendar, cf. ListingBookingCard.tsx), sélectionner une date
// demande : 1) de naviguer jusqu'au bon mois via les chevrons (le calendrier
// démarre toujours sur le mois courant au montage du composant), puis 2) de
// cliquer sur le numéro du jour dans la grille. Les boutons de jour sont de
// simples nombres sans aria-label, et les chevrons prev/next n'ont aucun nom
// accessible (icône seule) — on scope donc tout au conteneur de la carte
// calendrier (identifié par la grille `.grid-cols-7.gap-px` qu'il contient)
// pour ne jamais matcher un éventuel carrousel photo ailleurs sur la page.
function calendarContainer(page) {
  return page.locator('.rounded-2xl.border.border-line.bg-card.p-5', {
    has: page.locator('.grid.grid-cols-7.gap-px'),
  });
}

async function navigateCalendarMonths(page, count) {
  const selector = count > 0 ? 'button:has(i.fa-chevron-right)' : 'button:has(i.fa-chevron-left)';
  const btn = calendarContainer(page).locator(selector).first();
  for (let i = 0; i < Math.abs(count); i++) {
    await btn.click();
    await page.waitForTimeout(150);
  }
}

// `calState` suit le mois actuellement affiché par LE MÊME calendrier (pas
// rechargé entre les deux clics start/end) — il doit donc être créé une fois
// par appel à createBookingAndPay et réutilisé pour les deux dates, sans quoi
// le 2e clic recalculerait sa navigation depuis "aujourd'hui" au lieu de
// repartir du mois où le 1er clic a laissé le calendrier.
async function selectCalendarDate(page, isoDate, calState) {
  const target = new Date(`${isoDate}T00:00:00`);
  const delta = (target.getFullYear() - calState.year) * 12 + (target.getMonth() - calState.month);
  if (delta !== 0) {
    await navigateCalendarMonths(page, delta);
    const total = calState.month + delta;
    calState.year += Math.floor(total / 12);
    calState.month = ((total % 12) + 12) % 12;
  }
  const day = target.getDate();
  const dayButton = calendarContainer(page)
    .locator('.grid.grid-cols-7.gap-px button')
    .filter({ hasText: new RegExp(`^${day}$`) });
  await dayButton.click();
}

async function createBookingAndPay(page, { startDate, endDate }, label) {
  const calState = { month: new Date().getMonth(), year: new Date().getFullYear() };
  await selectCalendarDate(page, startDate, calState);
  if (endDate) await selectCalendarDate(page, endDate, calState);
  await shot(page, `${label}-03-dates-filled`);

  // Both listeners must be registered before the click: with PAYDUNYA_DEV_BYPASS active,
  // payments/initiate resolves almost instantly after bookings, so setting up its listener
  // only after awaiting the booking response risks missing the event entirely (race).
  const bookingRespPromise = page.waitForResponse((r) => r.url().endsWith('/api/v1/bookings') && r.request().method() === 'POST', { timeout: 15000 });
  const payRespPromise = page.waitForResponse((r) => r.url().endsWith('/api/v1/payments/initiate') && r.request().method() === 'POST', { timeout: 20000 });

  await page.getByRole('button', { name: 'Réserver et payer' }).click();

  const bookingResp = await bookingRespPromise;
  const bookingStatus = bookingResp.status();
  const bookingBody = await bookingResp.json().catch(() => null);
  await shot(page, `${label}-04-booking-created`);

  if (bookingStatus < 200 || bookingStatus >= 300) {
    log(`booking-create:${label}`, 'fail', { status: bookingStatus, body: bookingBody });
    throw new Error(`Booking creation failed: HTTP ${bookingStatus} — ${JSON.stringify(bookingBody)}`);
  }
  log(`booking-create:${label}`, 'pass', { bookingId: bookingBody.id, totalAmount: bookingBody.totalAmount });

  const payResp = await payRespPromise;
  const payStatus = payResp.status();
  const payBody = await payResp.json().catch(() => null);
  log(`payment-initiate:${label}`, payStatus < 300 ? 'pass' : 'fail', { status: payStatus, body: payBody });

  // give the redirect a moment to happen
  await page.waitForTimeout(3000);
  await shot(page, `${label}-05-after-payment-initiate`);
  log(`redirect-url:${label}`, 'info', { url: page.url() });

  return { booking: bookingBody, paymentUrl: payBody?.payment_url, currentUrl: page.url() };
}

/* ─────────────── bail mensuel + contrat (Phase 6/7) ─────────────── */

// Même assistant que publishListing() pour les étapes 0/1/2 communes, mais l'étape 3
// ("Mode de location & Prix") sélectionne explicitement le mode MENSUEL (même si c'est
// déjà la valeur par défaut du formulaire — cliqué pour la robustesse du test face à un
// futur changement de defaultValues) et remplit loyer + caution + durée minimale au lieu
// du prix par nuitée.
async function publishMonthlyListing(page, { title, monthlyRent, depositMonths, minLeaseMonths, city, address }) {
  await robustGoto(page, `${FRONTEND}/publier`, (p) => p.getByRole('button', { name: 'Appartement' }));
  await shot(page, 'monthly-listing-01-step0');

  await page.getByRole('button', { name: 'Appartement' }).click();
  await page.getByPlaceholder('Ex : Appartement 3 pièces meublé au Plateau').fill(title);
  await page.getByPlaceholder('Décrivez votre bien en détail : luminosité, état, proximité services, transports…')
    .fill('Bel appartement meublé, bail mensuel, idéal pour un test end-to-end automatisé.');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 1: caractéristiques (mêmes valeurs que publishListing()).
  await shot(page, 'monthly-listing-02-step1');
  const numberInputs = page.locator('main input[type="number"]');
  await numberInputs.nth(0).fill('85');
  await numberInputs.nth(1).fill('3');
  await numberInputs.nth(2).fill('2');
  await numberInputs.nth(3).fill('1');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 2: localisation
  await shot(page, 'monthly-listing-03-step2');
  await page.locator('main select').first().selectOption('Dakar');
  await page.getByPlaceholder('Ex : Plateau, Dakar').fill(city);
  await page.getByPlaceholder('Rue, numéro, résidence…').fill(address);
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 3: mode de location (MENSUEL) + loyer + caution. Le bloc NUITÉE ne se rend
  // pas en mode MENSUEL pur, donc les placeholders "Ex : 350 000"/"Ex : 2"/"Ex : 12"
  // sont sans ambiguïté ici.
  await shot(page, 'monthly-listing-04-step3');
  await page.getByRole('button', { name: 'Mensuel' }).click();
  await page.getByPlaceholder('Ex : 350 000').fill(String(monthlyRent));
  await page.getByPlaceholder('Ex : 2').fill(String(depositMonths));
  await page.getByPlaceholder('Ex : 12').fill(String(minLeaseMonths));
  await shot(page, 'monthly-listing-05-step3-filled');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 4: photos
  await shot(page, 'monthly-listing-06-step4');
  await uploadAndCropPhoto(page, path.join(__dirname, 'fixtures', 'test-listing.jpg'));
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 5: recap + publish
  await shot(page, 'monthly-listing-07-recap');
  const [createResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/v1/listings') && r.request().method() === 'POST', { timeout: 20000 }),
    page.getByRole('button', { name: 'Publier' }).click(),
  ]);

  const status = createResp.status();
  let body = null;
  try { body = await createResp.json(); } catch {}
  await shot(page, 'monthly-listing-08-after-submit');

  if (status >= 200 && status < 300) {
    log('publish-monthly-listing', 'pass', { listingId: body?.id, status: body?.status });
    return body;
  } else {
    log('publish-monthly-listing', 'fail', { status, body });
    throw new Error(`Monthly listing creation failed: HTTP ${status} — ${JSON.stringify(body)}`);
  }
}

// Ouvre l'annonce mensuelle et soumet une demande de location au mois via
// MonthlyBookingRequestForm (rendu directement, sans onglets, pour rentalMode MONTHLY pur).
async function requestMonthlyBooking(page, listingTitle, moveInDate) {
  await searchAndOpenListing(page, listingTitle);

  await page.locator('main input[type="date"]').fill(moveInDate);
  await shot(page, 'monthly-request-01-form-filled');

  const [reqResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/v1/bookings/monthly') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Envoyer la demande' }).click(),
  ]);

  const status = reqResp.status();
  const body = await reqResp.json().catch(() => null);
  await shot(page, 'monthly-request-02-submitted');

  if (status < 200 || status >= 300) {
    log('monthly-request', 'fail', { status, body });
    throw new Error(`Monthly booking request failed: HTTP ${status} — ${JSON.stringify(body)}`);
  }
  log('monthly-request', 'pass', { bookingId: body.id, status: body.status });
  return body;
}

// Compte tenu du décalage entre le paiement (qui déclenche la génération du contrat en
// tâche de fond côté serveur — PDF + upload Cloudinary) et son apparition côté client, on
// attend le lien de téléchargement du ContractCard avec une tolérance plus généreuse que
// robustGoto par défaut, un seul reload de secours.
async function waitForContractReady(page, url) {
  const readyLocator = (p) => p.getByRole('link', { name: 'Télécharger le contrat' });
  await robustGoto(page, url, readyLocator, { patientTimeout: 30000, reloadTimeout: 20000 });
}

/* ─────────── uniformisation UI réservations — vérifications admin ───────────
 * Vérifie que /espace/bookings (admin) est bien aligné sur locataire/bailleur
 * (mêmes composants BookingCard/BookingTabs/BookingSearchRow/BookingPagination)
 * et que les actions propres à l'admin (annuler, libérer/rembourser l'escrow,
 * résoudre un litige) fonctionnent de bout en bout. Ordre attendu (après
 * signup-bailleur, publish-listing, signup-locataire, book-1, book-2) :
 *   signup-admin, admin-fixture-cancel, admin-fixture-release,
 *   admin-fixture-refund, admin-fixture-dispute, admin-bookings-smoke,
 *   admin-cancel, admin-release, admin-refund, admin-dispute-report,
 *   admin-dispute-resolve
 * Les 4 réservations "fixture" utilisent des durées de séjour distinctes
 * (2/4/5/6 nuits, vs 1/3 pour book-1/book-2) pour que chaque montant total
 * reste unique et permette de cibler la bonne carte sans ambiguïté, même en
 * cas de reprise d'un run partiel via un E2E_RUN_ID fixe. */

function amountRegex(total) {
  return new RegExp(String(Math.floor(total)).replace(/(\d)(?=(\d{3})+$)/g, '$1.{0,2}'));
}

// Instrumentation ajoutée après l'anomalie "Confirmées 0 / Aucune réservation
// trouvée" malgré des réservations CONFIRMED/ACTIVE bien présentes en base
// (confirmé par requête SQL directe) — capture et logue la vraie réponse
// /bookings/all?status=CONFIRMED... reçue par le navigateur, pour distinguer
// un vrai bug backend (total/data ne matchent pas la requête envoyée) d'un
// problème de timing côté script (les 800ms fixes précédents ne garantissaient
// pas que la requête ait fini avant la capture d'écran suivante).
async function goToAdminBookingsConfirmedTab(page) {
  await robustGoto(page, `${FRONTEND}/espace/bookings`, (p) => p.getByText('Toutes les réservations'));
  const respPromise = page
    .waitForResponse((r) => r.url().includes('/bookings/all') && r.url().includes('status=CONFIRMED'), { timeout: 15000 })
    .catch(() => null);
  await page.getByRole('button', { name: /Confirmées/ }).click();
  const resp = await respPromise;
  if (resp) {
    const body = await resp.json().catch(() => null);
    log('admin-confirmed-tab-response', 'info', {
      url: resp.url(),
      status: resp.status(),
      total: body?.total,
      dataLength: Array.isArray(body?.data) ? body.data.length : null,
      firstIds: Array.isArray(body?.data) ? body.data.slice(0, 3).map((b) => b.id) : null,
    });
  } else {
    log('admin-confirmed-tab-response', 'warn', { msg: 'aucune réponse /bookings/all?status=CONFIRMED... observée sous 15s' });
  }
  await page.waitForTimeout(300);
}

async function stageAdminBookingsSmoke(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'admin-smoke');
  try {
    await signIn(page, state.admin, 'admin-smoke');
    await robustGoto(page, `${FRONTEND}/espace/bookings`, (p) => p.getByText('Toutes les réservations'));
    await shot(page, 'admin-smoke-01-pending-tab');

    // Onglets communs aux 3 rôles (mêmes libellés que locataire/bailleur).
    for (const label of ['En attente', 'Confirmées', 'Archivées']) {
      await page.getByRole('button', { name: new RegExp(label) }).waitFor({ state: 'visible', timeout: 5000 });
    }
    log('admin-smoke-tabs-present', 'pass');

    // Recherche + lignes par page (composants partagés BookingSearchRow).
    const searchInput = page.getByPlaceholder('Rechercher par bien, ville ou locataire…');
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText('Lignes :').waitFor({ state: 'visible', timeout: 5000 });
    log('admin-smoke-search-row-present', 'pass');

    // Bascule sur "Confirmées" — les réservations de test (fixtures + book-1/2) y sont.
    // Corps de la réponse capturé et loggé (pas juste attendue en silence) —
    // instrumentation ajoutée suite à l'anomalie "Confirmées 0" alors que la
    // base contient bien des réservations CONFIRMED/ACTIVE (vérifié en SQL
    // direct) : ce log dira si le backend renvoie vraiment total=0 pour cette
    // requête précise (vrai bug backend/filtre) ou si c'est le rendu qui ne
    // reflète pas une réponse pourtant correcte (bug frontend).
    const confirmedRespPromise = page
      .waitForResponse((r) => r.url().includes('/bookings/all') && r.url().includes('status=CONFIRMED'), { timeout: 15000 })
      .catch(() => null);
    await page.getByRole('button', { name: /Confirmées/ }).click();
    const confirmedResp = await confirmedRespPromise;
    if (confirmedResp) {
      const confirmedBody = await confirmedResp.json().catch(() => null);
      log('admin-smoke-confirmed-tab-response', 'info', {
        url: confirmedResp.url(),
        status: confirmedResp.status(),
        total: confirmedBody?.total,
        dataLength: Array.isArray(confirmedBody?.data) ? confirmedBody.data.length : null,
        firstIds: Array.isArray(confirmedBody?.data) ? confirmedBody.data.slice(0, 3).map((b) => b.id) : null,
      });
    } else {
      log('admin-smoke-confirmed-tab-response', 'warn', { msg: 'aucune réponse /bookings/all?status=CONFIRMED... observée sous 15s' });
    }
    await page.waitForTimeout(500);
    await shot(page, 'admin-smoke-02-confirmed-tab');
    const bodyAfterTab = await page.locator('body').innerText();
    const seesFixtures = bodyAfterTab.includes(state.listing.title);
    log('admin-smoke-sees-confirmed-bookings', seesFixtures ? 'pass' : 'fail', { msg: bodyAfterTab.slice(0, 400) });

    // Recherche : filtrer sur le titre de l'annonce de test ne doit ni planter
    // la page ni renvoyer d'erreur serveur.
    const [searchResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/bookings/all') && r.url().includes('search='), { timeout: 15000 }),
      searchInput.fill(state.listing.title),
    ]);
    await page.waitForTimeout(500); // au-delà du debounce de 300ms
    await shot(page, 'admin-smoke-03-search-filtered');
    log('admin-smoke-search-works', searchResp.status() < 300 ? 'pass' : 'fail', { status: searchResp.status() });
    await searchInput.fill('');
    await page.waitForTimeout(500);

    // Absence de débordement horizontal mobile/tablette — même garde-fou que
    // stageResponsiveSmoke, appliqué ici à une page authentifiée.
    for (const [device, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);
      await assertNoHorizontalOverflow(page, `admin-bookings-${device}`);
      await shot(page, `admin-smoke-04-${device}`);
      log(`admin-smoke-responsive-${device}`, 'pass');
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  } finally {
    await ctx.close();
  }
}

async function stageAdminCancel(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'admin-cancel');
  try {
    await signIn(page, state.admin, 'admin-cancel');
    await goToAdminBookingsConfirmedTab(page);
    await shot(page, 'admin-cancel-01-list');

    const row = page.locator('div', { hasText: state.listing.title })
      .filter({ hasText: amountRegex(state.adminFixtureCancel.totalAmount) })
      .filter({ hasText: 'Annuler réservation' })
      .last();
    await row.getByRole('button', { name: 'Annuler réservation' }).click();
    await shot(page, 'admin-cancel-02-modal');

    const cancelRespPromise = page.waitForResponse((r) => r.url().includes(`/bookings/${state.adminFixtureCancel.bookingId}/cancel`), { timeout: 15000 });
    await page.getByRole('button', { name: 'Annuler la réservation' }).click();
    const cancelResp = await cancelRespPromise;
    const cancelBody = await cancelResp.json().catch(() => null);
    await shot(page, 'admin-cancel-03-done');
    const ok = cancelResp.status() < 300 && cancelBody?.status === 'CANCELLED';
    log('admin-cancel-fixture', ok ? 'pass' : 'fail', { status: cancelResp.status(), body: cancelBody });
    if (!ok) throw new Error(`Annulation admin échouée ou incohérente: ${JSON.stringify(cancelBody)}`);
  } finally {
    await ctx.close();
  }
}

async function stageAdminRelease(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'admin-release');
  try {
    await signIn(page, state.admin, 'admin-release');
    await goToAdminBookingsConfirmedTab(page);
    await shot(page, 'admin-release-01-list');

    const row = page.locator('div', { hasText: state.listing.title })
      .filter({ hasText: amountRegex(state.adminFixtureRelease.totalAmount) })
      .filter({ hasText: 'Libérer au bailleur' })
      .last();
    await row.getByRole('button', { name: 'Libérer au bailleur' }).click();
    await shot(page, 'admin-release-02-modal');

    const releaseRespPromise = page.waitForResponse((r) => r.url().includes(`/payments/release/${state.adminFixtureRelease.bookingId}`), { timeout: 15000 });
    await page.getByRole('button', { name: 'Confirmer la libération' }).click();
    const releaseResp = await releaseRespPromise;
    const releaseBody = await releaseResp.json().catch(() => null);
    await shot(page, 'admin-release-03-done');
    const ok = releaseResp.status() < 300 && releaseBody?.escrowStatus === 'RELEASED';
    log('admin-release-fixture', ok ? 'pass' : 'fail', { status: releaseResp.status(), body: releaseBody });
    if (!ok) throw new Error(`Libération admin échouée ou incohérente: ${JSON.stringify(releaseBody)}`);
  } finally {
    await ctx.close();
  }
}

async function stageAdminRefund(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'admin-refund');
  try {
    await signIn(page, state.admin, 'admin-refund');
    await goToAdminBookingsConfirmedTab(page);
    await shot(page, 'admin-refund-01-list');

    const row = page.locator('div', { hasText: state.listing.title })
      .filter({ hasText: amountRegex(state.adminFixtureRefund.totalAmount) })
      .filter({ hasText: 'Rembourser locataire' })
      .last();
    await row.getByRole('button', { name: 'Rembourser locataire' }).click();
    await shot(page, 'admin-refund-02-modal');

    const refundRespPromise = page.waitForResponse((r) => r.url().includes(`/payments/refund/${state.adminFixtureRefund.bookingId}`), { timeout: 15000 });
    await page.getByRole('button', { name: 'Confirmer le remboursement' }).click();
    const refundResp = await refundRespPromise;
    const refundBody = await refundResp.json().catch(() => null);
    await shot(page, 'admin-refund-03-done');
    const ok = refundResp.status() < 300 && refundBody?.escrowStatus === 'REFUNDED';
    log('admin-refund-fixture', ok ? 'pass' : 'fail', { status: refundResp.status(), body: refundBody });
    if (!ok) throw new Error(`Remboursement admin échoué ou incohérent: ${JSON.stringify(refundBody)}`);
  } finally {
    await ctx.close();
  }
}

// Signale la non-conformité côté locataire (fenêtre de 24h depuis startDate —
// adminFixtureDispute démarre aujourd'hui, cf. STAGE_MAP) via un appel API
// direct plutôt que l'UI, même pattern que stageCompleteRejectedAndOwnerCancel :
// ce test cible la résolution admin du litige, pas le formulaire de
// signalement locataire (qui exige un upload de preuve réel).
async function stageAdminDisputeReport(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'admin-dispute-report');
  try {
    await signIn(page, state.locataire, 'admin-dispute-report');

    const result = await page.evaluate(async ({ bookingId }) => {
      const token = await window.Clerk?.session?.getToken();
      const res = await fetch(`http://localhost:4000/api/v1/bookings/${bookingId}/report-dispute`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: "Le logement ne correspond pas du tout à la description, présence de moisissures et mauvaises odeurs.",
          evidence: ['https://via.placeholder.com/600x400?text=Preuve'],
        }),
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    }, { bookingId: state.adminFixtureDispute.bookingId });

    const ok = result.status < 300 && result.body?.escrowStatus === 'DISPUTED';
    log('report-dispute', ok ? 'pass' : 'fail', result);
    if (!ok) throw new Error(`Signalement de litige échoué: HTTP ${result.status} — ${JSON.stringify(result.body)}`);
  } finally {
    await ctx.close();
  }
}

async function stageAdminDisputeResolve(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'admin-dispute-resolve');
  try {
    await signIn(page, state.admin, 'admin-dispute-resolve');
    await goToAdminBookingsConfirmedTab(page);
    await shot(page, 'admin-dispute-resolve-01-list');

    const row = page.locator('div', { hasText: state.listing.title })
      .filter({ hasText: amountRegex(state.adminFixtureDispute.totalAmount) })
      .filter({ hasText: 'En litige' })
      .filter({ hasText: 'Clore : libérer au bailleur' })
      .last();

    // Le détail du litige (motif signalé par le locataire) ne s'affiche que
    // sur une réservation DISPUTED — vérifie qu'il est bien visible avant de
    // le résoudre (footer partagé injecté par AdminBookingCard).
    await row.getByText('Motif signalé par le locataire').waitFor({ state: 'visible', timeout: 5000 });
    await shot(page, 'admin-dispute-resolve-02-detail-visible');
    log('admin-dispute-detail-visible', 'pass');

    await row.getByRole('button', { name: 'Clore : libérer au bailleur' }).click();
    await shot(page, 'admin-dispute-resolve-03-modal');

    const resolveRespPromise = page.waitForResponse((r) => r.url().includes(`/bookings/${state.adminFixtureDispute.bookingId}/resolve-dispute`), { timeout: 15000 });
    await page.getByRole('button', { name: 'Libérer au bailleur' }).click();
    const resolveResp = await resolveRespPromise;
    const resolveBody = await resolveResp.json().catch(() => null);
    await shot(page, 'admin-dispute-resolve-04-done');
    const ok = resolveResp.status() < 300 && resolveBody?.escrowStatus === 'RELEASED' && resolveBody?.status === 'COMPLETED';
    log('admin-dispute-resolve', ok ? 'pass' : 'fail', { status: resolveResp.status(), body: resolveBody });
    if (!ok) throw new Error(`Résolution du litige échouée ou incohérente: ${JSON.stringify(resolveBody)}`);

    // Une fois COMPLETED, la réservation doit basculer dans l'onglet
    // "Archivées" — vérifie la cohérence inter-onglets du regroupement de
    // statuts (lib/bookingStatus.ts, partagé avec locataire/bailleur).
    await page.getByRole('button', { name: /Archivées/ }).click();
    await page.waitForTimeout(800);
    const archivedBody = await page.locator('body').innerText();
    const seesInArchived = archivedBody.includes(state.listing.title);
    await shot(page, 'admin-dispute-resolve-05-archived-tab');
    log('admin-dispute-resolved-moved-to-archived', seesInArchived ? 'pass' : 'fail');
  } finally {
    await ctx.close();
  }
}

/* ───────────────────── responsive smoke ────────────────────
 * Pas de couverture mobile/tablette avant ce lot — toute la suite tournait
 * au viewport desktop par défaut de Chromium. Ce stage ouvre les pages
 * publiques les plus visitées à des largeurs mobile (375px) et tablette
 * (768px), vérifie l'absence de débordement horizontal (cause n°1 de
 * rupture visuelle sur petit écran) et que le menu hamburger s'ouvre. */

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
};

const RESPONSIVE_PAGES = ['/', '/listings', '/agences', '/cookies', '/cgu'];

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) {
    throw new Error(`Horizontal overflow detected on ${label}: scrollWidth exceeds viewport by ${overflow}px`);
  }
}

async function stageResponsiveSmoke(browser) {
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport, hasTouch: device === 'mobile' });
    const page = await ctx.newPage();
    attachDiagnostics(page, `responsive-${device}`);
    try {
      for (const route of RESPONSIVE_PAGES) {
        await page.goto(`${FRONTEND}${route}`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await assertNoHorizontalOverflow(page, `${device}${route}`);
        await shot(page, `responsive-${device}-${route === '/' ? 'home' : route.replace(/\//g, '_')}`);
        log(`responsive:${device}${route}`, 'pass', { width: viewport.width });
      }

      // Le menu hamburger (lg:hidden) doit s'ouvrir en dessous de 1024px, à
      // mobile comme à tablette — c'est le seul accès à la nav sur ces tailles.
      await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
      const menuBtn = page.getByRole('button', { name: /Ouvrir le menu|Open menu/i });
      await menuBtn.waitFor({ state: 'visible', timeout: 5000 });
      await menuBtn.click();
      await page.waitForTimeout(300); // transition CSS
      const closeBtn = page.getByRole('button', { name: /Fermer le menu|Close menu/i });
      await closeBtn.waitFor({ state: 'visible', timeout: 5000 });
      await shot(page, `responsive-${device}-menu-open`);
      log(`responsive:${device}-menu-toggle`, 'pass');
    } finally {
      await ctx.close();
    }
  }
}

/* ───────────────────────── stages ───────────────────────── */

async function stageSignupBailleur(browser) {
  const created = await createClerkUser(BAILLEUR);
  log('create-user:bailleur', 'pass', { clerkId: created.id, email: BAILLEUR.email });

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'bailleur');
  try {
    await signIn(page, BAILLEUR, 'bailleur');
    await becomeBailleur(page, '+221771234567');
    state.bailleur = { email: BAILLEUR.email, password: BAILLEUR.password, clerkId: created.id };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

async function stagePublishListing(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'publish');
  try {
    await signIn(page, state.bailleur, 'publish');
    const title = `Appartement Test E2E ${RUN_ID}`;
    const listing = await publishListing(page, {
      title, price: 250000, city: 'Plateau', address: `Rue ${RUN_ID}, Plateau`,
    });
    state.listing = { id: listing.id, title, price: 250000 };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

async function stageSignupLocataire(browser) {
  const created = await createClerkUser(LOCATAIRE);
  log('create-user:locataire', 'pass', { clerkId: created.id, email: LOCATAIRE.email });

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'locataire');
  try {
    await signIn(page, LOCATAIRE, 'locataire');
    state.locataire = { email: LOCATAIRE.email, password: LOCATAIRE.password, clerkId: created.id };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

async function stageSignupAdmin(browser) {
  const created = await createClerkUser(ADMIN);
  log('create-user:admin', 'pass', { clerkId: created.id, email: ADMIN.email });

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'admin-signup');
  try {
    await signIn(page, ADMIN, 'admin-signup');

    // ClerkAuthGuard ne crée la ligne Postgres `users` qu'au premier appel API
    // authentifié — on la force ici via GET /auth/me (accessible à tout
    // utilisateur connecté) avant l'UPDATE SQL qui attribue ADMIN, sans quoi
    // celui-ci ne trouverait aucune ligne à modifier.
    const meResp = await page.evaluate(async () => {
      const token = await window.Clerk?.session?.getToken();
      const res = await fetch('http://localhost:4000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    log('admin-me-bootstrap', meResp.status < 300 ? 'pass' : 'fail', meResp);
    if (meResp.status >= 300) throw new Error(`GET /auth/me a échoué: ${JSON.stringify(meResp)}`);

    grantAdminRole(created.id);
    log('grant-admin-role', 'pass', { clerkId: created.id });

    state.admin = { email: ADMIN.email, password: ADMIN.password, clerkId: created.id };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

async function stageBookAndPay(browser, { label, startOffsetDays, durationDays }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, label);
  try {
    await signIn(page, state.locataire, label);
    await searchAndOpenListing(page, state.listing.title);
    const startDate = futureDate(startOffsetDays);
    const endDate = futureDate(startOffsetDays + durationDays);
    const result = await createBookingAndPay(page, { startDate, endDate }, label);
    state[label] = { bookingId: result.booking.id, totalAmount: result.booking.totalAmount, startDate, endDate, paymentUrl: result.paymentUrl, landedUrl: result.currentUrl };
    saveState(state);
    log(`stage:${label}`, 'pass', state[label]);
  } finally {
    await ctx.close();
  }
}

async function stageBailleurViewBookings(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'bailleur-view');
  try {
    await signIn(page, state.bailleur, 'bailleur-view');
    await robustGoto(page, `${FRONTEND}/bailleur/bookings`, (p) => p.getByText('Confirmées'));
    await shot(page, 'bailleur-bookings-01-list');
    const bodyText = await page.locator('body').innerText();
    const seesBoth = bodyText.includes(state.listing.title);
    log('bailleur-sees-bookings', seesBoth ? 'pass' : 'fail', { msg: bodyText.slice(0, 600) });
  } finally {
    await ctx.close();
  }
}

// BookingActions.tsx now renders an "Annuler" button for CONFIRMED bookings too (fix for
// the UI gap where only "Marquer terminé" was offered, even though the backend's shared
// /bookings/:id/cancel endpoint already supported owner cancellation). The cancel step
// below clicks that real button. The "complete" rejection check still goes through the
// bailleur's authenticated fetch directly by booking ID — accumulated test-account
// bookings from earlier debugging runs share this same listing title, making DOM row
// targeting by text alone ambiguous ("Marquer terminé" appears on every CONFIRMED row).
async function stageCompleteRejectedAndOwnerCancel(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'owner-actions');
  try {
    await signIn(page, state.bailleur, 'owner-actions');
    await robustGoto(page, `${FRONTEND}/bailleur/bookings`, (p) => p.getByText('Marquer terminé').first());
    await shot(page, 'owner-actions-01-list');

    const callApi = (bookingId, action) => page.evaluate(async ({ bookingId, action }) => {
      const token = await window.Clerk?.session?.getToken();
      const res = await fetch(`http://localhost:4000/api/v1/bookings/${bookingId}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    }, { bookingId, action });

    // booking2 is CONFIRMED but its stay hasn't started/ended yet — "complete" must be rejected.
    const completeResult = await callApi(state.booking2.bookingId, 'complete');
    await shot(page, 'owner-actions-02-complete-attempt');
    log('complete-rejected-too-early', completeResult.status === 400 ? 'pass' : 'fail', completeResult);

    // Owner cancels booking2 via the real "Annuler" button (the fix being verified here).
    // Disambiguate the row by booking2's exact total, same pattern as stageCancelTenant.
    const amountPattern = new RegExp(String(Math.floor(state.booking2.totalAmount ?? 25000)).replace(/(\d)(?=(\d{3})+$)/g, '$1.{0,2}'));
    const row = page.locator('div', { hasText: state.listing.title }).filter({ hasText: amountPattern }).filter({ hasText: 'Annuler' }).last();
    const cancelRespPromise = page.waitForResponse((r) => r.url().includes(`/bookings/${state.booking2.bookingId}/cancel`), { timeout: 15000 });
    await row.getByRole('button', { name: 'Annuler' }).click();
    const cancelResp = await cancelRespPromise;
    const cancelBody = await cancelResp.json().catch(() => null);
    await shot(page, 'owner-actions-03-cancel-clicked');
    log('owner-cancel-booking2', cancelResp.status() < 300 ? 'pass' : 'fail', { status: cancelResp.status(), body: cancelBody });
    state.booking2Cancel = { status: cancelResp.status(), body: cancelBody };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

async function stageCancelTenant(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'tenant-cancel');
  try {
    await signIn(page, state.locataire, 'tenant-cancel');
    await robustGoto(page, `${FRONTEND}/locataire/bookings`, (p) => p.getByText('Confirmées'));
    await shot(page, 'tenant-cancel-01-list');

    // Disambiguate by amount: accumulated bookings from earlier debugging runs share this
    // same listing title, so title text alone would match multiple rows. booking1's total
    // (8 333 FCFA) is unique among them, tolerating whatever thousands-separator char
    // Intl.NumberFormat renders (space / NBSP / narrow-NBSP) via the regex gap.
    const amountPattern = new RegExp(String(Math.floor(state.booking1.totalAmount ?? 8333)).replace(/(\d)(?=(\d{3})+$)/g, '$1.{0,2}'));
    const row = page.locator('div', { hasText: state.listing.title }).filter({ hasText: amountPattern }).filter({ hasText: 'Annuler' }).last();
    await row.getByRole('button', { name: 'Annuler' }).click();
    await shot(page, 'tenant-cancel-02-modal');

    const cancelRespPromise = page.waitForResponse((r) => r.url().includes(`/bookings/${state.booking1.bookingId}/cancel`), { timeout: 15000 });
    await page.getByRole('button', { name: "Confirmer l'annulation" }).click();
    const cancelResp = await cancelRespPromise;
    const cancelBody = await cancelResp.json().catch(() => null);
    await shot(page, 'tenant-cancel-03-done');
    log('tenant-cancel-booking1', cancelResp.status() < 300 ? 'pass' : 'fail', { status: cancelResp.status(), body: cancelBody });
    state.booking1Cancel = { status: cancelResp.status(), body: cancelBody };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

// Regression test for the NaN/optional-fields bug: surface/rooms/beds/baths are optional
// in the Zod schema, but an untouched number input used to become NaN via valueAsNumber,
// which Zod's .optional() silently rejected — "Suivant" would no-op on step "Caractéristiques"
// with no visible error. Fixed via setValueAs normalizing "" to undefined. This test leaves
// those fields empty on purpose and asserts the wizard still reaches step 2 (Localisation).
async function stageRegressionEmptyOptionalFields(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'regression-empty-fields');
  try {
    await signIn(page, state.bailleur, 'regression-empty-fields');
    await robustGoto(page, `${FRONTEND}/publier`, (p) => p.getByRole('button', { name: 'Appartement' }));
    await shot(page, 'regression-01-step0');

    await page.getByRole('button', { name: 'Appartement' }).click();
    await page.getByPlaceholder('Ex : Appartement 3 pièces meublé au Plateau').fill('Regression test — champs optionnels vides');
    await page.getByPlaceholder('Décrivez votre bien en détail : luminosité, état, proximité services, transports…')
      .fill('Vérifie que le formulaire avance bien même si Surface/Pièces/Chambres/SdB restent vides.');
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Step 1 (Caractéristiques): deliberately leave surface/rooms/beds/baths empty.
    await shot(page, 'regression-02-step1-empty');
    await page.getByRole('button', { name: 'Suivant' }).click();

    // Must reach step 2 (Localisation) — the region <select> becomes visible if the bug is fixed.
    await page.locator('main select').first().waitFor({ state: 'visible', timeout: 8000 });
    await shot(page, 'regression-03-step2-reached');
    log('regression-empty-optional-fields', 'pass', { msg: 'Advanced past step1 with surface/rooms/beds/baths left empty' });
  } catch (err) {
    await shot(page, 'regression-FAILED');
    log('regression-empty-optional-fields', 'fail', { msg: String(err?.message || err) });
    throw err;
  } finally {
    await ctx.close();
  }
}

// ─────────── Phase 6/7 : bail mensuel + génération du contrat ───────────
// Requiert PAYDUNYA_DEV_BYPASS=true côté Backend (même prérequis implicite que
// book-1/book-2 ci-dessus) pour que payments/initiate confirme le paiement de
// façon synchrone sans passer par une vraie redirection PayDunya.
//
// Chaîne complète : publish-monthly-listing → monthly-request → monthly-approve
// → monthly-pay → contract-ready.
// Chaque étape sauvegarde son état dans state.json pour que les étapes suivantes
// (invocations séparées de node flow.mjs) puissent le relire.

async function stagePublishMonthlyListing(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'monthly-listing');
  try {
    await signIn(page, state.bailleur, 'monthly-listing');
    const title = `Bail Test E2E ${RUN_ID}`;
    const listing = await publishMonthlyListing(page, {
      title, monthlyRent: 200000, depositMonths: 2, minLeaseMonths: 3,
      city: 'Plateau', address: `Rue Bail ${RUN_ID}, Plateau`,
    });
    state.monthlyListing = { id: listing.id, title, monthlyRent: 200000, depositMonths: 2, minLeaseMonths: 3 };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

async function stageMonthlyRequest(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'monthly-request');
  try {
    await signIn(page, state.locataire, 'monthly-request');
    const moveInDate = futureDate(30);
    const booking = await requestMonthlyBooking(page, state.monthlyListing.title, moveInDate);
    state.monthlyBooking = { id: booking.id, status: booking.status, totalAmount: booking.totalAmount, moveInDate };
    saveState(state);
  } finally {
    await ctx.close();
  }
}

async function stageMonthlyApprove(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'monthly-approve');
  try {
    await signIn(page, state.bailleur, 'monthly-approve');
    // Compte locataire/bailleur fraîchement créés à chaque run (email horodaté par
    // RUN_ID) : contrairement aux stages nuitée book-1/book-2 (qui accumulent des
    // réservations d'anciens runs de debug sur le même compte), il n'y a ici qu'une
    // seule demande REQUESTED — pas besoin de désambiguïser par montant.
    await robustGoto(page, `${FRONTEND}/bailleur/bookings`, (p) => p.getByRole('button', { name: 'Approuver' }).first());
    await shot(page, 'monthly-approve-01-list');

    const [approveResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/bookings/${state.monthlyBooking.id}/approve`), { timeout: 15000 }),
      page.getByRole('button', { name: 'Approuver' }).first().click(),
    ]);
    const status = approveResp.status();
    const body = await approveResp.json().catch(() => null);
    await shot(page, 'monthly-approve-02-approved');
    log('monthly-approve', status < 300 ? 'pass' : 'fail', { status, body });
    if (status >= 300) throw new Error(`Monthly approval failed: HTTP ${status} — ${JSON.stringify(body)}`);
    state.monthlyBooking.status = body.status;
    saveState(state);
  } finally {
    await ctx.close();
  }
}

async function stageMonthlyPay(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, 'monthly-pay');
  try {
    await signIn(page, state.locataire, 'monthly-pay');
    await robustGoto(page, `${FRONTEND}/locataire/bookings`, (p) => p.getByRole('button', { name: /Payer le ticket d.entrée/ }).first());
    await shot(page, 'monthly-pay-01-list');

    const [payResp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/v1/payments/initiate') && r.request().method() === 'POST', { timeout: 20000 }),
      page.getByRole('button', { name: /Payer le ticket d.entrée/ }).first().click(),
    ]);
    const status = payResp.status();
    const body = await payResp.json().catch(() => null);
    // Laisse le temps à markBookingPaid (synchrone côté bypass) + à la génération
    // best-effort du contrat (fire-and-forget côté serveur) de démarrer.
    await page.waitForTimeout(3000);
    await shot(page, 'monthly-pay-02-after-initiate');
    log('monthly-pay', status < 300 ? 'pass' : 'fail', { status, body });
    if (status >= 300) throw new Error(`Monthly payment initiate failed: HTTP ${status} — ${JSON.stringify(body)}`);
    state.monthlyBooking.status = 'ACTIVE';
    saveState(state);
  } finally {
    await ctx.close();
  }
}

// Le contrat n'est plus signé numériquement dans l'app (signature manuscrite en
// personne) — on vérifie seulement que le lien de téléchargement du PDF généré
// apparaît bien pour les deux parties une fois le bail actif. Un contexte par
// utilisateur, comme partout ailleurs dans ce fichier (pas de switch d'utilisateur
// au sein d'une même session Clerk).
async function stageContractReady(browser) {
  const tenantCtx = await browser.newContext();
  const tenantPage = await tenantCtx.newPage();
  attachDiagnostics(tenantPage, 'contract-ready-tenant');
  try {
    await signIn(tenantPage, state.locataire, 'contract-ready-tenant');
    await waitForContractReady(tenantPage, `${FRONTEND}/locataire/bookings`);
    await shot(tenantPage, 'contract-ready-01-tenant');
    log('contract-ready:tenant', 'pass', { bookingId: state.monthlyBooking.id });
  } finally {
    await tenantCtx.close();
  }

  const landlordCtx = await browser.newContext();
  const landlordPage = await landlordCtx.newPage();
  attachDiagnostics(landlordPage, 'contract-ready-landlord');
  try {
    await signIn(landlordPage, state.bailleur, 'contract-ready-landlord');
    await waitForContractReady(landlordPage, `${FRONTEND}/bailleur/bookings`);
    await shot(landlordPage, 'contract-ready-02-landlord');
    log('contract-ready:landlord', 'pass', { bookingId: state.monthlyBooking.id });
  } finally {
    await landlordCtx.close();
  }
}

/* ───────────────────────── main ───────────────────────── */

const STAGE_MAP = {
  'signup-bailleur': () => stageSignupBailleur,
  'publish-listing': () => stagePublishListing,
  'signup-locataire': () => stageSignupLocataire,
  // booking1: décalé de 1 à 8 jours pour ne pas chevaucher la fixture
  // admin-fixture-dispute (occupe désormais 0-6 sur ce même listing — doit
  // démarrer aujourd'hui pour la fenêtre de 24h de reportDispute, donc c'est
  // booking1 qui doit bouger). ATTENTION : à 8 jours, hoursUntilStart (~192h)
  // dépasse le seuil de 7*24h utilisé par bookings.service.ts pour la
  // pénalité "annulation tardive -> RELEASED" — le stage tenant-cancel (non
  // exécuté dans la chaîne admin actuelle) prendrait donc la branche normale
  // REFUNDED au lieu de RELEASED s'il est relancé avec cet état. À corriger
  // (ex. en libérant un jour dans la fenêtre 0-6, ou un autre listing dédié)
  // avant de relancer tenant-cancel/complete-and-owner-cancel.
  'book-1': () => (browser) => stageBookAndPay(browser, { label: 'booking1', startOffsetDays: 8, durationDays: 1 }),
  // booking2: start in 20 days (> 7-day window, well past the stale range) — for the
  // reject-early-complete + owner-cancels-> REFUNDED tests.
  'book-2': () => (browser) => stageBookAndPay(browser, { label: 'booking2', startOffsetDays: 20, durationDays: 3 }),
  'bailleur-view-bookings': () => stageBailleurViewBookings,
  'complete-and-owner-cancel': () => stageCompleteRejectedAndOwnerCancel,
  'tenant-cancel': () => stageCancelTenant,
  'regression-empty-fields': () => stageRegressionEmptyOptionalFields,
  // Phase 6/7 — bail mensuel + contrat de bail généré (signature manuscrite en
  // personne, plus de signature numérique dans l'app). Ordre d'exécution attendu :
  // signup-bailleur, publish-monthly-listing, signup-locataire, monthly-request,
  // monthly-approve, monthly-pay, contract-ready.
  'publish-monthly-listing': () => stagePublishMonthlyListing,
  'monthly-request': () => stageMonthlyRequest,
  'monthly-approve': () => stageMonthlyApprove,
  'monthly-pay': () => stageMonthlyPay,
  'contract-ready': () => stageContractReady,
  // Indépendant du reste — pas de compte requis, peut tourner seul :
  // node e2e/flow.mjs responsive-smoke
  'responsive-smoke': () => stageResponsiveSmoke,
  // Uniformisation UI réservations — vérifications admin (espace/bookings).
  // Requiert signup-bailleur, publish-listing, signup-locataire, book-1,
  // book-2 déjà passés (réutilise state.listing/state.locataire). Ordre :
  // signup-admin, admin-fixture-cancel, admin-fixture-release,
  // admin-fixture-refund, admin-fixture-dispute, admin-bookings-smoke,
  // admin-cancel, admin-release, admin-refund, admin-dispute-report,
  // admin-dispute-resolve. Nécessite aussi PAYDUNYA_DEV_BYPASS=true côté
  // Backend, comme book-1/book-2 (paiement confirmé de façon synchrone).
  'signup-admin': () => stageSignupAdmin,
  // Offsets espacés d'au moins 2 jours entre la fin d'une fixture et le début
  // de la suivante : un jour de fin partagé avec un jour de début (ex. 40-42
  // puis 42-46) suffit à bloquer la sélection calendrier, le jour de checkout
  // étant lui-même marqué réservé côté AvailabilityCalendar (bug rencontré et
  // corrigé ici — cancel[40,42] et release[42,46] partageaient le jour 42).
  'admin-fixture-cancel': () => (browser) => stageBookAndPay(browser, { label: 'adminFixtureCancel', startOffsetDays: 40, durationDays: 2 }),
  'admin-fixture-release': () => (browser) => stageBookAndPay(browser, { label: 'adminFixtureRelease', startOffsetDays: 44, durationDays: 4 }),
  'admin-fixture-refund': () => (browser) => stageBookAndPay(browser, { label: 'adminFixtureRefund', startOffsetDays: 50, durationDays: 5 }),
  // Démarre aujourd'hui (startOffsetDays: 0) pour rester dans la fenêtre de
  // 24h de reportDispute (admin-dispute-report doit tourner juste après).
  'admin-fixture-dispute': () => (browser) => stageBookAndPay(browser, { label: 'adminFixtureDispute', startOffsetDays: 0, durationDays: 6 }),
  'admin-bookings-smoke': () => stageAdminBookingsSmoke,
  'admin-cancel': () => stageAdminCancel,
  'admin-release': () => stageAdminRelease,
  'admin-refund': () => stageAdminRefund,
  'admin-dispute-report': () => stageAdminDisputeReport,
  'admin-dispute-resolve': () => stageAdminDisputeResolve,
};

async function main() {
  const stages = process.argv.slice(2);
  if (stages.length === 0) {
    console.log('Usage: node flow.mjs <stage> [stage...]');
    console.log('Stages:', Object.keys(STAGE_MAP).join(', '));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const s of stages) {
      const factory = STAGE_MAP[s];
      if (!factory) { log(s, 'fail', { msg: 'unknown stage' }); continue; }
      log(s, 'start');
      try {
        await factory()(browser);
        log(s, 'done');
      } catch (err) {
        log(s, 'error', { msg: String(err?.message || err) });
        throw err;
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
