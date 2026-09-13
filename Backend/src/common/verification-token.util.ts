import * as crypto from 'crypto';
import type { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode') as typeof import('qrcode');

// ─────────────────────────────────────────────────────────────────────────
// Token de vérification d'identité locataire (QR code) — signé par HMAC-
// SHA256, sans état (stateless) : aucune table dédiée, aucune expiration
// embarquée. La validité réelle (statut de la réservation, fenêtre de
// dates) est recalculée à CHAQUE vérification à partir des données live en
// base (cf. BookingsService.verifyPublic) — jamais depuis le contenu du
// token lui-même. Propriété importante : le token reste stable pour toute
// la durée de vie d'une réservation (même contenu qu'il soit généré à
// l'instant T ou T+6 mois), donc un QR imprimé une fois sur un reçu/contrat
// PDF reste valide sans jamais avoir besoin d'être régénéré — seule la
// réponse de vérification change si la réservation est ensuite annulée,
// terminée, etc.
//
// Format du token : "<bookingId en base64url>.<signature HMAC en base64url>"
// Comparaison de signature en temps constant (crypto.timingSafeEqual) pour
// éviter une attaque par timing.
// ─────────────────────────────────────────────────────────────────────────

const SEPARATOR = '.';

export function signVerificationToken(
  bookingId: string,
  secret: string,
): string {
  const payload = Buffer.from(bookingId, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}${SEPARATOR}${signature}`;
}

/**
 * Retourne le bookingId si la signature est valide, sinon `null`. Ne lève
 * jamais d'exception — un token malformé/forgé est un cas attendu (scan
 * d'un vieux lien, tentative de falsification), pas une erreur serveur.
 */
export function verifyVerificationToken(
  token: string,
  secret: string,
): string | null {
  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const bookingId = Buffer.from(payload, 'base64url').toString('utf8');
    return bookingId || null;
  } catch {
    return null;
  }
}

/**
 * Génère l'image PNG (buffer) du QR code pointant vers l'URL de
 * vérification publique — utilisé pour l'incruster dans les PDF (reçu de
 * réservation, contrat de bail).
 */
export function generateVerificationQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 220,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

const DEV_FALLBACK_VERIFICATION_SECRET =
  'dev-insecure-booking-verification-secret-do-not-use-in-prod';

let warnedDevFallbackSecret = false;

/**
 * Résout le secret HMAC signant les tokens de vérification QR à partir de
 * BOOKING_VERIFICATION_SECRET. Exigé en production ; en dev/test, retombe
 * sur une valeur fixe non sécurisée (avec un avertissement loggué une seule
 * fois) pour ne pas bloquer le développement local si la variable n'est pas
 * encore configurée. Centralisé ici (plutôt que dupliqué dans
 * BookingsService et ContractsService) pour que les deux services signent
 * avec exactement le même secret.
 */
export function resolveVerificationSecret(
  config: ConfigService,
  logger?: { warn: (msg: string) => void },
): string {
  const secret = config.get<string>('BOOKING_VERIFICATION_SECRET');
  if (secret) return secret;

  const isProd = config.get<string>('NODE_ENV') === 'production';
  if (isProd) {
    throw new Error(
      'BOOKING_VERIFICATION_SECRET doit être configuré en production (QR de vérification locataire).',
    );
  }
  if (!warnedDevFallbackSecret) {
    logger?.warn(
      "[QR vérification] BOOKING_VERIFICATION_SECRET absent — utilisation d'un secret de développement non sécurisé. À configurer avant la mise en production.",
    );
    warnedDevFallbackSecret = true;
  }
  return DEV_FALLBACK_VERIFICATION_SECRET;
}
