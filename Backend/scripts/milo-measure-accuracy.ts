/**
 * Milo Search v0 — lot 7, étape 2/2. Mesure l'exactitude du jeu de dev
 * (src/milo/dev-dataset.ts) par critère et par langue — sert à comparer
 * avant/après les corrections (lancé une fois sur l'ancien code via
 * `git stash`, une fois sur le nouveau).
 *
 * Usage : npx ts-node -r tsconfig-paths/register scripts/milo-measure-accuracy.ts
 */
import { extractCriteria } from '../src/milo/extractCriteria';
import { DEV_DATASET, type DevCase } from '../src/milo/dev-dataset';
import type { MiloExtractionResult } from '../src/milo/types';

function checkCase(
  c: DevCase,
  r: MiloExtractionResult,
): { ok: boolean; failedFields: string[] } {
  const failed: string[] = [];
  const f = r.strictFilters;
  const e = c.expect;

  if ('type' in e && (f.type ?? null) !== (e.type ?? null)) failed.push('type');
  if (
    'transactionType' in e &&
    (f.transactionType ?? null) !== (e.transactionType ?? null)
  )
    failed.push('transactionType');
  if ('region' in e && (f.region ?? null) !== (e.region ?? null))
    failed.push('region');
  if (
    'cityContains' in e &&
    (f.cityContains ?? null) !== (e.cityContains ?? null)
  )
    failed.push('cityContains');
  if ('minPrice' in e && (f.minPrice ?? null) !== (e.minPrice ?? null))
    failed.push('minPrice');
  if ('maxPrice' in e && (f.maxPrice ?? null) !== (e.maxPrice ?? null))
    failed.push('maxPrice');
  if ('minBeds' in e && (f.minBeds ?? null) !== (e.minBeds ?? null))
    failed.push('minBeds');
  if ('maxBeds' in e && (f.maxBeds ?? null) !== (e.maxBeds ?? null))
    failed.push('maxBeds');
  if ('minRooms' in e && (f.minRooms ?? null) !== (e.minRooms ?? null))
    failed.push('minRooms');
  if ('maxRooms' in e && (f.maxRooms ?? null) !== (e.maxRooms ?? null))
    failed.push('maxRooms');
  if (e.amenitiesInclude) {
    const have = f.amenities ?? [];
    for (const a of e.amenitiesInclude)
      if (!have.includes(a)) failed.push(`amenities:${a}`);
  }
  if (e.softPreferencesInclude) {
    for (const s of e.softPreferencesInclude)
      if (!r.softPreferences.includes(s)) failed.push(`softPreferences:${s}`);
  }
  if (e.ambiguitiesInclude) {
    for (const a of e.ambiguitiesInclude)
      if (!r.ambiguities.includes(a)) failed.push(`ambiguities:${a}`);
  }

  return { ok: failed.length === 0, failedFields: failed };
}

function run(cases: DevCase[]) {
  let ok = 0;
  const byKlass: Record<string, { ok: number; total: number }> = {};
  const failures: { id: string; text: string; failed: string[] }[] = [];
  for (const c of cases) {
    const r = extractCriteria(c.text);
    const { ok: pass, failedFields } = checkCase(c, r);
    byKlass[c.klass] ??= { ok: 0, total: 0 };
    byKlass[c.klass].total++;
    if (pass) {
      ok++;
      byKlass[c.klass].ok++;
    } else {
      failures.push({ id: c.id, text: c.text, failed: failedFields });
    }
  }
  return { ok, total: cases.length, byKlass, failures };
}

for (const [lang, cases] of Object.entries(DEV_DATASET)) {
  const { ok, total, byKlass, failures } = run(cases);
  console.log(
    `\n=== ${lang.toUpperCase()} : ${ok}/${total} (${((ok / total) * 100).toFixed(1)}%) ===`,
  );
  for (const [klass, { ok: kOk, total: kTotal }] of Object.entries(byKlass)) {
    console.log(
      `  ${klass}: ${kOk}/${kTotal} (${((kOk / kTotal) * 100).toFixed(1)}%)`,
    );
  }
  if (process.argv.includes('--verbose')) {
    for (const f of failures)
      console.log(`  FAIL ${f.id} "${f.text}" — ${f.failed.join(', ')}`);
  }
}

const all = [...DEV_DATASET.fr, ...DEV_DATASET.en, ...DEV_DATASET.mixed];
const { ok, total } = run(all);
console.log(
  `\n=== TOTAL : ${ok}/${total} (${((ok / total) * 100).toFixed(1)}%) ===`,
);
