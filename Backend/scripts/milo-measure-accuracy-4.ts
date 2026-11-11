/**
 * Milo Search v0 — lot meublé/durée de location (classes : meublé/négation,
 * durée, prix par nuit, conflit). Mesure le jeu de dev
 * (src/milo/dev-dataset-4.ts) séparément du jeu de validation tenu à part
 * (`held`), par classe.
 *
 * Usage : npx ts-node -r tsconfig-paths/register scripts/milo-measure-accuracy-4.ts
 */
import { extractCriteria } from '../src/milo/extractCriteria';
import { DEV_DATASET_4, type DevCase4 } from '../src/milo/dev-dataset-4';
import type { MiloExtractionResult } from '../src/milo/types';

function checkCase(
  c: DevCase4,
  r: MiloExtractionResult,
): { ok: boolean; failed: string[] } {
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
  if ('minBeds' in e && (f.minBeds ?? null) !== (e.minBeds ?? null))
    failed.push('minBeds');
  if ('maxBeds' in e && (f.maxBeds ?? null) !== (e.maxBeds ?? null))
    failed.push('maxBeds');
  if ('furnished' in e && (f.furnished ?? null) !== (e.furnished ?? null))
    failed.push('furnished');
  if ('rentalMode' in e && (f.rentalMode ?? null) !== (e.rentalMode ?? null))
    failed.push('rentalMode');
  if (
    'minPricePerNight' in e &&
    (f.minPricePerNight ?? null) !== (e.minPricePerNight ?? null)
  )
    failed.push('minPricePerNight');
  if (
    'maxPricePerNight' in e &&
    (f.maxPricePerNight ?? null) !== (e.maxPricePerNight ?? null)
  )
    failed.push('maxPricePerNight');
  if (e.ambiguitiesInclude) {
    for (const a of e.ambiguitiesInclude)
      if (!r.ambiguities.includes(a)) failed.push(`ambiguities:${a}`);
  }
  if (e.ambiguitiesExclude) {
    for (const a of e.ambiguitiesExclude)
      if (r.ambiguities.includes(a)) failed.push(`ambiguities-excl:${a}`);
  }
  return { ok: failed.length === 0, failed };
}

function run(cases: DevCase4[]) {
  let ok = 0;
  const byKlass: Record<string, { ok: number; total: number }> = {};
  const failures: { id: string; text: string; failed: string[] }[] = [];
  for (const c of cases) {
    const r = extractCriteria(c.text);
    const { ok: pass, failed } = checkCase(c, r);
    byKlass[c.klass] ??= { ok: 0, total: 0 };
    byKlass[c.klass].total++;
    if (pass) {
      ok++;
      byKlass[c.klass].ok++;
    } else {
      failures.push({ id: c.id, text: c.text, failed });
    }
  }
  return { ok, total: cases.length, byKlass, failures };
}

function report(label: string, cases: DevCase4[]) {
  const { ok, total, byKlass, failures } = run(cases);
  console.log(
    `\n=== ${label} : ${ok}/${total} (${((ok / total) * 100).toFixed(1)}%) ===`,
  );
  for (const [klass, { ok: kOk, total: kTotal }] of Object.entries(byKlass)) {
    console.log(
      `  classe ${klass}: ${kOk}/${kTotal} (${((kOk / kTotal) * 100).toFixed(1)}%)`,
    );
  }
  if (process.argv.includes('--verbose')) {
    for (const f of failures)
      console.log(`  FAIL ${f.id} "${f.text}" — ${f.failed.join(', ')}`);
  }
}

const devCases = DEV_DATASET_4.filter((c) => !c.held);
const heldCases = DEV_DATASET_4.filter((c) => c.held);
const negCount = DEV_DATASET_4.filter((c) => c.negative).length;

console.log(
  `Jeu total : ${DEV_DATASET_4.length} cas (${devCases.length} dev, ${heldCases.length} tenus à part), ${negCount} pièges négatifs (${((negCount / DEV_DATASET_4.length) * 100).toFixed(0)}%)`,
);
report('JEU DE DEV', devCases);
report('JEU TENU À PART (validation)', heldCases);
