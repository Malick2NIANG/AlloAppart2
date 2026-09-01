// Test de charge post-lancement AlloAppart (k6).
// Installation : https://k6.io/docs/get-started/installation/
// Usage :
//   k6 run scripts/load-test.js
//   k6 run -e BASE_URL=https://api.alloappart.sn scripts/load-test.js
//   k6 run -e BASE_URL=https://api.alloappart.sn -e VUS=50 -e DURATION=2m scripts/load-test.js
//
// Cible par défaut les endpoints PUBLICS (aucune auth requise) : recherche
// d'annonces, détail d'annonce, page d'accueil frontend. C'est le trafic
// dominant attendu (visiteurs qui parcourent avant de créer un compte).

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:3000';
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '1m';

export const options = {
  scenarios: {
    browse_listings: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'], // 95% des requêtes < 800ms
    http_req_failed: ['rate<0.01'],                  // moins de 1% d'échecs
  },
};

export default function () {
  // 1. Recherche d'annonces (endpoint le plus sollicité en réalité)
  const listRes = http.get(`${BASE_URL}/api/v1/listings?page=1&limit=20`, {
    tags: { name: 'GET /listings' },
  });
  check(listRes, {
    'listings: status 200': (r) => r.status === 200,
    'listings: body non vide': (r) => r.body && r.body.length > 0,
  });

  sleep(1);

  // 2. Détail d'une annonce, si la recherche en a renvoyé une
  try {
    const body = JSON.parse(listRes.body);
    const items = Array.isArray(body) ? body : body.data || body.items || [];
    if (items.length > 0 && items[0].id) {
      const detailRes = http.get(`${BASE_URL}/api/v1/listings/${items[0].id}`, {
        tags: { name: 'GET /listings/:id' },
      });
      check(detailRes, { 'detail: status 200': (r) => r.status === 200 });
    }
  } catch (_e) {
    // réponse non-JSON ou vide — pas bloquant pour le test de charge
  }

  sleep(1);

  // 3. Page d'accueil du frontend (SSR Next.js)
  const homeRes = http.get(FRONTEND_URL, { tags: { name: 'GET / (frontend)' } });
  check(homeRes, { 'home: status 200': (r) => r.status === 200 });

  sleep(2);
}
