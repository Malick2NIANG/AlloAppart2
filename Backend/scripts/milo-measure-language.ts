/**
 * Mesure la précision de detectLanguage() sur Backend/src/milo/tests/language.json
 * — précision par catégorie (fr/en/mixed/short/other), précision fr/en
 * restreinte aux requêtes de 4 mots et plus (seuil visé ≥ 90 %), p95 du
 * temps d'exécution. Lecture seule, rien n'est modifié.
 *
 * Usage : npx ts-node -r tsconfig-paths/register scripts/milo-measure-language.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { detectLanguage } from '../src/milo/language/detectLanguage';

interface Entry {
  category: 'fr' | 'en' | 'mixed' | 'short' | 'other';
  defaultLocale: 'fr' | 'en';
  expectedLanguage: 'fr' | 'en' | 'unsupported';
  query: string;
}

const DATA_PATH = path.resolve(__dirname, '../src/milo/tests/language.json');
const entries = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')) as Entry[];

function wordCount(q: string): number {
  return q.trim().split(/\s+/).filter(Boolean).length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, idx)];
}

const byCategory = new Map<string, { correct: number; total: number }>();
const durations: number[] = [];
let fr4Correct = 0;
let fr4Total = 0;
let en4Correct = 0;
let en4Total = 0;

for (const e of entries) {
  const start = process.hrtime.bigint();
  const result = detectLanguage(e.query, e.defaultLocale);
  const end = process.hrtime.bigint();
  durations.push(Number(end - start) / 1e6); // ms

  const bucket = byCategory.get(e.category) ?? { correct: 0, total: 0 };
  bucket.total++;
  if (result.language === e.expectedLanguage) bucket.correct++;
  byCategory.set(e.category, bucket);

  if (wordCount(e.query) >= 4) {
    if (e.category === 'fr') {
      fr4Total++;
      if (result.language === e.expectedLanguage) fr4Correct++;
    }
    if (e.category === 'en') {
      en4Total++;
      if (result.language === e.expectedLanguage) en4Correct++;
    }
  }
}

durations.sort((a, b) => a - b);
const p95 = percentile(durations, 95);

console.log('--- Précision par catégorie ---');
for (const [cat, { correct, total }] of byCategory) {
  const pct = ((correct / total) * 100).toFixed(1);
  console.log(`${cat.padEnd(8)} ${correct}/${total}  (${pct}%)`);
}

console.log('\n--- Seuils visés ---');
console.log(
  `FR (>=4 mots) : ${fr4Correct}/${fr4Total} (${((fr4Correct / fr4Total) * 100).toFixed(1)}%) — seuil >= 90%`,
);
console.log(
  `EN (>=4 mots) : ${en4Correct}/${en4Total} (${((en4Correct / en4Total) * 100).toFixed(1)}%) — seuil >= 90%`,
);
console.log(`p95 : ${p95.toFixed(3)} ms — seuil < 50 ms`);

const totalCorrect = [...byCategory.values()].reduce(
  (s, b) => s + b.correct,
  0,
);
const totalAll = [...byCategory.values()].reduce((s, b) => s + b.total, 0);
console.log(
  `\nGlobal : ${totalCorrect}/${totalAll} (${((totalCorrect / totalAll) * 100).toFixed(1)}%)`,
);
