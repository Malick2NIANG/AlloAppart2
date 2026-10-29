/**
 * Mesure le temps d'exécution de MiloService.parseQuery() sur des textes de
 * 300 caractères pathologiques, EN ISOLATION (pas dans la suite Jest — sous
 * charge complète, le p95 mesuré dépend de la contention CPU entre workers
 * Jest, pas de l'algorithme ; voir milo-robustness.spec.ts).
 *
 * Usage : npx ts-node -r tsconfig-paths/register scripts/milo-measure-robustness.ts
 */
import { MiloService } from '../src/milo/milo.service';

const service = new MiloService();

const pathological: Record<string, string> = {
  lettresRepetees: 'a'.repeat(300),
  chiffresRepetes: '1'.repeat(300),
  separateursRepetes: '.,'.repeat(150),
  chiffresEtSeparateursAlternes: '1.2,3.4,5.6,'.repeat(25),
  espacesSeulement: ' '.repeat(300),
  unSeulGrandToken: '1234567890'.repeat(30),
  caracteresDeControle: ('\u0000\u0001\u0002\u001f'.repeat(20) + ' texte').slice(0, 300),
  emojis: '🏠🔑🏡💰'.repeat(75).slice(0, 300),
  melangeRealiste: (
    'F3 climatise '.repeat(10) +
    '350000 '.repeat(10) +
    'a louer a vendre '.repeat(5)
  ).slice(0, 300),
  nombresEnormes: '999999999999999999999999999999 '.repeat(9).slice(0, 300),
  kEtMRepetes: '350k 1.5m 2m 100k 50k 999k 1m '.repeat(10).slice(0, 300),
  exactement300: 'F3 climatise a louer sous 400000 a Dakar '.repeat(8).slice(0, 300),
};

function percentile(sorted: number[], p: number): number {
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

const durations: number[] = [];
const PASSES = 50;
for (let pass = 0; pass < PASSES; pass++) {
  for (const text of Object.values(pathological)) {
    const start = process.hrtime.bigint();
    service.parseQuery({ text, defaultLocale: 'fr' });
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
}
durations.sort((a, b) => a - b);

console.log(`Échantillons : ${durations.length} (${Object.keys(pathological).length} textes × ${PASSES} passes)`);
console.log(`min    : ${durations[0].toFixed(3)} ms`);
console.log(`p50    : ${percentile(durations, 50).toFixed(3)} ms`);
console.log(`p95    : ${percentile(durations, 95).toFixed(3)} ms  — seuil < 50 ms`);
console.log(`p99    : ${percentile(durations, 99).toFixed(3)} ms`);
console.log(`max    : ${durations[durations.length - 1].toFixed(3)} ms`);
