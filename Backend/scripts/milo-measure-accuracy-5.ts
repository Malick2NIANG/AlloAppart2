/**
 * Milo Search v0 — fix « prix nu par nuit en budget cible ». Mesure le jeu
 * de dev (src/milo/dev-dataset-5.ts) séparément du jeu tenu à part (`held`).
 *
 * Usage : npx ts-node -r tsconfig-paths/register scripts/milo-measure-accuracy-5.ts
 */
import { extractCriteria } from '../src/milo/extractCriteria';
import { DEV_DATASET_5, type DevCase5 } from '../src/milo/dev-dataset-5';
import type { MiloExtractionResult } from '../src/milo/types';

function checkCase(
  c: DevCase5,
  r: MiloExtractionResult,
): { ok: boolean; failed: string[] } {
  const failed: string[] = [];
  const f = r.strictFilters;
  const e = c.expect;

  if (
    'maxPricePerNight' in e &&
    (f.maxPricePerNight ?? null) !== (e.maxPricePerNight ?? null)
  )
    failed.push('maxPricePerNight');
  if ('maxPrice' in e && (f.maxPrice ?? null) !== (e.maxPrice ?? null))
    failed.push('maxPrice');
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

function run(cases: DevCase5[]) {
  let ok = 0;
  const failures: { id: string; text: string; failed: string[] }[] = [];
  for (const c of cases) {
    const r = extractCriteria(c.text);
    const { ok: pass, failed } = checkCase(c, r);
    if (pass) ok++;
    else failures.push({ id: c.id, text: c.text, failed });
  }
  return { ok, total: cases.length, failures };
}

function report(label: string, cases: DevCase5[]) {
  const { ok, total, failures } = run(cases);
  console.log(
    `\n=== ${label} : ${ok}/${total} (${((ok / total) * 100).toFixed(1)}%) ===`,
  );
  if (process.argv.includes('--verbose')) {
    for (const f of failures)
      console.log(`  FAIL ${f.id} "${f.text}" — ${f.failed.join(', ')}`);
  }
}

const devCases = DEV_DATASET_5.filter((c) => !c.held);
const heldCases = DEV_DATASET_5.filter((c) => c.held);
const negCount = DEV_DATASET_5.filter((c) => c.negative).length;

console.log(
  `Jeu total : ${DEV_DATASET_5.length} cas (${devCases.length} dev, ${heldCases.length} tenus à part), ${negCount} pièges négatifs (${((negCount / DEV_DATASET_5.length) * 100).toFixed(0)}%)`,
);
report('JEU DE DEV', devCases);
report('JEU TENU À PART (validation)', heldCases);
