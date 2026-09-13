import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Service partagé pour l'intégration PayDunya — utilisé par les
 * réservations, le boost d'annonce, les vérifications AlloVérifié et les
 * abonnements PRO_AGENCE. Chaque flux crée une invoice classique
 * (checkout-invoice/create) et redirige le client vers la page de paiement
 * hébergée par PayDunya, qui gère elle-même le choix du moyen de paiement
 * (Orange Money, Wave, Mixx by Yas, carte bancaire). Ce service se charge
 * ensuite de confirmer le statut de l'invoice (webhook + vérification
 * active), jamais du paiement lui-même.
 */

export interface InvoiceStatus {
  status: string; // 'completed' | 'pending' | 'cancelled' | 'failed'
  totalAmount: number;
  customData: Record<string, unknown>;
}

@Injectable()
export class PaydunyaSoftpayService {
  private readonly logger = new Logger(PaydunyaSoftpayService.name);

  constructor(private readonly config: ConfigService) {}

  private headers() {
    const masterKey = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token = this.config.get<string>('PAYDUNYA_TOKEN');
    if (!masterKey || !privateKey || !token) {
      throw new BadRequestException('Payment service unavailable');
    }
    return {
      'PAYDUNYA-MASTER-KEY': masterKey,
      'PAYDUNYA-PRIVATE-KEY': privateKey,
      'PAYDUNYA-TOKEN': token,
      'Content-Type': 'application/json',
    };
  }

  private isDev() {
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  private baseUrl() {
    return this.isDev()
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';
  }

  /** Vérification active du statut d'une invoice PayDunya (réservation, boost ou abonnement). */
  async confirmInvoiceStatus(
    paymentToken: string,
  ): Promise<InvoiceStatus | null> {
    const res = await axios
      .get<{
        response_code: string;
        status: string;
        invoice: { total_amount: number };
        custom_data: Record<string, unknown>;
      }>(`${this.baseUrl()}/checkout-invoice/confirm/${paymentToken}`, {
        headers: this.headers(),
      })
      .catch(() => null);
    if (!res) return null;
    return {
      status: res.data.status,
      totalAmount: Number(res.data.invoice?.total_amount ?? 0),
      customData: res.data.custom_data ?? {},
    };
  }

  /**
   * Vérifie et parse un callback IPN (webhook) PayDunya reçu en
   * `application/x-www-form-urlencoded`, dont le corps entier est imbriqué
   * sous une clé racine `data` (ex: `data[invoice][token]`, `data[hash]`,
   * `data[custom_data][booking_id]`, ...). Express/Nest le transforme en
   * `{ data: { invoice: { token }, hash, custom_data, status, ... } }`.
   *
   * SÉCURITÉ — deux couches indépendantes, aucune des deux n'est sautable :
   *  1. Le hash (SHA-512 de notre PAYDUNYA_MASTER_KEY) filtre le bruit / les
   *     appels totalement étrangers à notre compte PayDunya.
   *  2. Cette vérification ne suffit PAS à elle seule : ce hash est une
   *     valeur fixe (pas une signature par requête), donc potentiellement
   *     rejouable. C'est pourquoi les appelants de cette méthode ne doivent
   *     JAMAIS faire confiance au `status`/montant contenus dans ce payload
   *     — ils doivent systématiquement rappeler `confirmInvoiceStatus(token)`
   *     en autoregardant PayDunya avec nos clés d'API, qui est la seule
   *     source de vérité authentifiée.
   */
  verifyAndParseCallback(rawBody: Record<string, unknown>): {
    token: string;
    customData: Record<string, unknown>;
  } {
    const masterKey = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    if (!masterKey) {
      throw new BadRequestException('Payment service unavailable');
    }

    const data = rawBody?.['data'];
    if (!data || typeof data !== 'object') {
      this.logger.warn(
        'PayDunya callback rejeté — payload invalide (pas de noeud "data")',
      );
      throw new BadRequestException('Invalid callback payload');
    }
    const dataObj = data as Record<string, unknown>;

    const receivedHash = dataObj['hash'];
    if (typeof receivedHash !== 'string' || receivedHash.length === 0) {
      this.logger.warn('PayDunya callback rejeté — hash absent');
      throw new BadRequestException('Missing callback signature');
    }

    const expectedHash = crypto
      .createHash('sha512')
      .update(masterKey)
      .digest('hex');
    const receivedBuf = Buffer.from(receivedHash, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const validHash =
      receivedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(receivedBuf, expectedBuf);

    if (!validHash) {
      this.logger.warn(
        'PayDunya callback rejeté — signature invalide (hash ne correspond pas)',
      );
      throw new BadRequestException('Invalid callback signature');
    }

    const invoice = dataObj['invoice'];
    const token =
      invoice && typeof invoice === 'object'
        ? (invoice as Record<string, unknown>)['token']
        : undefined;
    if (typeof token !== 'string' || token.length === 0) {
      this.logger.warn('PayDunya callback rejeté — token de facture absent');
      throw new BadRequestException(
        'Invalid callback payload — missing invoice token',
      );
    }

    const customDataRaw = dataObj['custom_data'];
    const customData =
      customDataRaw && typeof customDataRaw === 'object'
        ? (customDataRaw as Record<string, unknown>)
        : {};

    return { token, customData };
  }
}
