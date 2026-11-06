/**
 * Mode tunnel de développement (VS Code Dev Tunnels) — permet d'utiliser
 * l'application depuis un tunnel public
 * (https://<id>-3000.<région>.devtunnels.ms) exactement comme en local,
 * sans jamais changer les .env de la machine de développement.
 *
 * Centralise ici (au lieu de dupliquer NEXT_PUBLIC_API_URL /
 * NEXT_PUBLIC_SOKETI_* dans chaque composant) la seule règle qui change :
 * côté NAVIGATEUR, si l'hôte courant est un hôte de tunnel, dériver API et
 * Soketi à partir de ce MÊME hôte (seul le port change dans le nom
 * d'hôte, 3000 → 4000/6001) ; dans tous les autres cas — serveur (pas de
 * `window`), ou navigateur sur localhost/IP LAN/domaine de prod —
 * comportement actuel inchangé : les variables d'environnement, telles
 * quelles. Aucune nouvelle variable d'environnement n'est nécessaire.
 */

// Hôte de tunnel EXACT : `<id>-<port>.<reste>devtunnels.ms`. Le port courant
// (groupe 2) n'est volontairement pas réutilisé — on le remplace par celui
// du service visé ; `reste` (groupe 3, ex. "eun1.") garde la sous-région
// telle quelle.
const DEV_TUNNEL_HOSTNAME_RE =
  /^([a-z0-9-]+)-(\d+)\.([a-z0-9.-]*)devtunnels\.ms$/;

interface DevTunnelMatch {
  id: string;
  regionSuffix: string;
}

function matchDevTunnelHostname(hostname: string): DevTunnelMatch | null {
  const m = DEV_TUNNEL_HOSTNAME_RE.exec(hostname);
  return m ? { id: m[1], regionSuffix: m[3] } : null;
}

/** `null` côté serveur (pas de `window`) ou si l'hôte n'est pas un tunnel. */
function browserDevTunnelMatch(): DevTunnelMatch | null {
  if (typeof window === 'undefined') return null;
  return matchDevTunnelHostname(window.location.hostname);
}

function devTunnelHost(tunnel: DevTunnelMatch, port: number): string {
  return `${tunnel.id}-${port}.${tunnel.regionSuffix}devtunnels.ms`;
}

const DEFAULT_API_URL = 'http://localhost:4000/api/v1';

/**
 * Base URL de l'API REST — à utiliser PARTOUT où le NAVIGATEUR appelle
 * directement le backend (lib/api.ts, lib/milo.ts, composants client avec
 * fetch absolu). Ne jamais utiliser côté serveur (Server Components, route
 * handlers) : y garder `process.env.NEXT_PUBLIC_API_URL` directement,
 * comme avant — cette fonction retombe de toute façon sur la même valeur
 * dès qu'il n'y a pas de `window` (voir `browserDevTunnelMatch`).
 */
export function getApiBaseUrl(): string {
  const tunnel = browserDevTunnelMatch();
  if (tunnel) return `https://${devTunnelHost(tunnel, 4000)}/api/v1`;
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

export interface RealtimeConfig {
  key: string;
  host: string;
  port: number;
  useTLS: boolean;
}

/**
 * Configuration Pusher/Soketi — à utiliser PARTOUT où le navigateur ouvre
 * une connexion temps réel (MessagesShell, NotificationBell). Même règle
 * que `getApiBaseUrl` : hôte de tunnel → `<id>-6001.<reste>devtunnels.ms`
 * en HTTPS/WSS (port 443, comme en prod derrière Caddy) ; sinon, les
 * variables d'environnement actuelles.
 */
export function getRealtimeConfig(): RealtimeConfig {
  const key = process.env.NEXT_PUBLIC_SOKETI_APP_KEY ?? '';
  const tunnel = browserDevTunnelMatch();
  if (tunnel) {
    return { key, host: devTunnelHost(tunnel, 6001), port: 443, useTLS: true };
  }
  const host = process.env.NEXT_PUBLIC_SOKETI_HOST ?? 'localhost';
  const port = Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? '6001');
  return { key, host, port, useTLS: port === 443 };
}
