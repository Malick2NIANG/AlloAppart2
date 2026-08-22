// AlloAppart — E2E manual script (not run via `playwright test`, run via `node e2e/flow.mjs [stages...]`)
// Drives a real Chromium against http://localhost:3001 / http://localhost:4000/api/v1
// and logs progress + screenshots + console/network errors to e2e/screenshots and e2e/log.jsonl.

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, 'screenshots');
const LOG_FILE = path.join(__dirname, 'log.jsonl');
const STATE_FILE = path.join(__dirname, 'state.json');
fs.mkdirSync(SS_DIR, { recursive: true });

const FRONTEND = 'http://localhost:3001';
const RUN_ID = process.env.E2E_RUN_ID || String(Date.now());

// Clerk's Cloudflare Turnstile bot-protection blocks headless signUp.create() calls.
// Clerk's documented bypass for automated testing: fetch a short-lived Testing Token via
// the Backend API and pass it as ?__clerk_testing_token=<token> on the page navigation —
// ClerkJS then forwards it on subsequent Frontend API calls. See:
// https://clerk.com/docs/guides/development/testing/overview
function getClerkSecretKey() {
  const envPath = path.join(__dirname, '..', '..', 'Backend', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^CLERK_SECRET_KEY=(.+)$/m);
  if (!match) throw new Error('CLERK_SECRET_KEY not found in Backend/.env');
  return match[1].trim();
}

async function getClerkTestingToken() {
  const res = await fetch('https://api.clerk.com/v1/testing_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getClerkSecretKey()}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch Clerk testing token: HTTP ${res.status}`);
  const body = await res.json();
  return body.token;
}

// Sign-up's captcha (Cloudflare Turnstile) hangs indefinitely in this headless Chromium
// environment even with a Testing Token (server-side bypass only — client still tries to
// solve the widget). Decision taken with the user: create test users directly via Clerk's
// Backend API (server-to-server, no captcha involved) and exercise the real browser
// /sign-in form for everything downstream instead of /sign-up.
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
  await page.waitForURL(`${FRONTEND}/`, { timeout: 15000 });
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

  // Step 3: prix
  await shot(page, 'listing-06-step3');
  await page.getByPlaceholder('Ex : 350 000').fill(String(price));
  await shot(page, 'listing-07-step3-filled');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Step 4: photos
  await shot(page, 'listing-08-step4');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-listing.jpg'));
  // wait for upload to finish: primary badge or done thumbnail appears
  await page.waitForTimeout(3000);
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

async function createBookingAndPay(page, { startDate, endDate }, label) {
  const dateInputs = page.locator('main input[type="date"]');
  await dateInputs.nth(0).fill(startDate);
  if (endDate) await dateInputs.nth(1).fill(endDate);
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

/* ───────────────────────── main ───────────────────────── */

const STAGE_MAP = {
  'signup-bailleur': () => stageSignupBailleur,
  'publish-listing': () => stagePublishListing,
  'signup-locataire': () => stageSignupLocataire,
  // booking1: start in 1 day (< 7-day window) — for the tenant-cancels-late-> RELEASED
  // escrow test. Avoids Aug 25-27 2026, occupied by a stale unpaid booking from an
  // earlier real-PayDunya-checkout attempt before PAYDUNYA_DEV_BYPASS was enabled.
  'book-1': () => (browser) => stageBookAndPay(browser, { label: 'booking1', startOffsetDays: 1, durationDays: 1 }),
  // booking2: start in 20 days (> 7-day window, well past the stale range) — for the
  // reject-early-complete + owner-cancels-> REFUNDED tests.
  'book-2': () => (browser) => stageBookAndPay(browser, { label: 'booking2', startOffsetDays: 20, durationDays: 3 }),
  'bailleur-view-bookings': () => stageBailleurViewBookings,
  'complete-and-owner-cancel': () => stageCompleteRejectedAndOwnerCancel,
  'tenant-cancel': () => stageCancelTenant,
  'regression-empty-fields': () => stageRegressionEmptyOptionalFields,
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
