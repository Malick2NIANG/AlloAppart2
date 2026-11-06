/**
 * Mode tunnel de développement (VS Code Dev Tunnels) — permet d'ouvrir le
 * CORS à l'origine https://<id>-3000.<région>.devtunnels.ms (le frontend
 * servi par le tunnel) SANS changer FRONTEND_URL ni le comportement par
 * défaut. N'a aucun effet tant que la variable d'environnement
 * ALLOW_DEV_TUNNELS n'est pas exactement "true" — absente ou toute autre
 * valeur : comportement identique à avant, en dev comme en production.
 */

// Origine EXACTE : `https://<id>-3000.<reste>devtunnels.ms` — seul le port
// 3000 (frontend) est accepté ici ; 4000 (API) et 6001 (Soketi) n'ont pas
// besoin d'figurer dans la liste CORS du frontend (ce n'est pas une origine
// qui nous appelle).
const DEV_TUNNEL_ORIGIN_RE =
  /^https:\/\/[a-z0-9-]+-3000\.[a-z0-9.-]*devtunnels\.ms$/;

export interface CorsOriginEnv {
  frontendUrl: string;
  allowDevTunnels: boolean;
}

/**
 * Décide si `origin` doit être accepté pour la branche de PRODUCTION du
 * CORS (égalité stricte avec FRONTEND_URL — inchangé — OU, uniquement si
 * `allowDevTunnels` est vrai, une origine de tunnel au motif exact
 * ci-dessus). La branche développement (`isDev` dans main.ts) reste, elle,
 * inchangée : elle accepte déjà tout, cette fonction ne la concerne pas.
 */
export function isProductionOriginAllowed(
  origin: string | undefined,
  env: CorsOriginEnv,
): boolean {
  if (origin === env.frontendUrl) return true;
  if (!env.allowDevTunnels) return false;
  return !!origin && DEV_TUNNEL_ORIGIN_RE.test(origin);
}
