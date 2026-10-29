/**
 * Milo Search v0 — vérifie que chaque phrase du placeholder tournant de la
 * barre hero (src/components/milo/examples.ts, lot 6.0 — plus de pastilles
 * cliquables depuis ce lot) est bien comprise (understood: true) par le
 * Backend réel. Script de vérification ponctuelle, PAS un test Vitest : le
 * job Frontend de la CI ne démarre pas le Backend, donc ce script a besoin
 * d'une instance locale déjà lancée (npm run start[:dev] dans Backend/) pour
 * fonctionner — usage manuel uniquement, comme
 * Backend/scripts/milo-measure-robustness.ts.
 *
 * Usage : npx tsx scripts/milo-verify-examples.ts
 */
import { MILO_EXAMPLES } from '../src/components/milo/examples';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface ParseQueryResponse {
  detectedLanguage: string;
  strictFilters: Record<string, unknown>;
  understood: boolean;
}

async function check(text: string, defaultLocale: 'fr' | 'en'): Promise<void> {
  const res = await fetch(`${API_URL}/search/parse-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, defaultLocale }),
  });
  const json = (await res.json()) as ParseQueryResponse;
  const status = json.understood ? 'OK  ' : 'FAIL';
  console.log(`[${status}] (${defaultLocale}) "${text}"`);
  console.log(`       detectedLanguage=${json.detectedLanguage} strictFilters=${JSON.stringify(json.strictFilters)}`);
  if (!json.understood) process.exitCode = 1;
}

async function main() {
  for (const text of MILO_EXAMPLES.fr) await check(text, 'fr');
  for (const text of MILO_EXAMPLES.en) await check(text, 'en');
}

void main();
