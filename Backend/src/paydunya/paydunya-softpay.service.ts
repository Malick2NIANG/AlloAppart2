import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Service partagé pour l'intégration PayDunya SOFTPAY / PSR (Paiement Sans
 * Redirection) — utilisé par les réservations, le boost d'annonce et les
 * abonnements PRO_AGENCE. Chaque flux crée d'abord une invoice classique
 * (checkout-invoice/create) pour obtenir un token, puis appelle l'un des
 * moyens de paiement ci-dessous avec ce même token, sans jamais rediriger
 * le client vers la page hébergée PayDunya (sauf pour la carte bancaire,
 * qui reste en redirection car hors de portée de la certification PCI-DSS
 * requise pour la carte via SOFTPAY brut).
 */

export interface SoftpayCustomer {
  paymentToken: string;
  customerName: string;
  customerEmail: string;
  phone: string;
}

export interface SoftpayResult {
  success: boolean;
  message: string;
  /** Orange Money : URL de la page QR code PayDunya. */
  url?: string;
  /** Orange Money : deep-link vers l'appli Orange Money. */
  omUrl?: string;
  /** Orange Money : deep-link vers l'appli Maxit. */
  maxitUrl?: string;
}

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

  /**
   * En sandbox, PayDunya n'expose AUCUN endpoint SOFTPAY (paiement direct
   * sans redirection), quel que soit le chemin — confirmé empiriquement en
   * testant 4 chemins plausibles/documentés (softpay/checkout/make-payment,
   * softpay/paydunya, softpay/wave-senegal, softpay/new-orange-money-senegal)
   * sous sandbox-api/v1 : les 4 renvoient un 404 HTML générique du site
   * PayDunya (pas une réponse API), alors que checkout-invoice/create et
   * .../confirm/:token fonctionnent normalement sous ce même préfixe.
   * La doc "Sandbox SoftPay" (https://developers.paydunya.com/doc/FR/sandbox_softpay)
   * semble donc obsolète ou jamais réellement implémentée côté PayDunya.
   *
   * Le seul moyen constaté de tester un paiement SOFTPAY en sandbox est de
   * rediriger vers la page hébergée de l'invoice — son URL suit le format
   * déterministe `https://paydunya.com/sandbox-checkout/invoice/{token}`
   * (confirmé par les réponses réelles de checkout-invoice/create) — qui
   * affiche un formulaire de connexion avec le compte de test PayDunya
   * (PAYDUNYA_TEST_EMAIL / _PHONE / _PASSWORD). C'est exactement le même
   * mécanisme que le paiement carte (redirection + polling), simplement
   * jamais branché jusqu'ici pour Orange Money / Wave / Free Money.
   */
  private sandboxSimulate(paymentToken: string): SoftpayResult {
    const email = this.config.get<string>('PAYDUNYA_TEST_EMAIL');
    const phone = this.config.get<string>('PAYDUNYA_TEST_PHONE');
    const password = this.config.get<string>('PAYDUNYA_TEST_PASSWORD');
    if (!email || !phone || !password) {
      this.logger.error(
        'PAYDUNYA_TEST_EMAIL/_PHONE/_PASSWORD manquants — nécessaires pour afficher les identifiants du compte de test sur la page de paiement sandbox PayDunya.',
      );
      throw new BadRequestException(
        'Simulation de paiement indisponible en environnement de test (compte de test PayDunya non configuré).',
      );
    }
    return {
      success: true,
      message: `Connectez-vous sur la page PayDunya avec ${email} (ou ${phone}) et le mot de passe de test configuré.`,
      url: `https://paydunya.com/sandbox-checkout/invoice/${paymentToken}`,
    };
  }

  async payWithOrangeMoney(c: SoftpayCustomer): Promise<SoftpayResult> {
    if (this.isDev()) return this.sandboxSimulate(c.paymentToken);
    const res = await axios
      .post<{
        success: boolean;
        message: string;
        url?: string;
        other_url?: { om_url?: string; maxit_url?: string };
      }>(
        `${this.baseUrl()}/softpay/new-orange-money-senegal`,
        {
          customer_name: c.customerName,
          customer_email: c.customerEmail,
          phone_number: c.phone,
          invoice_token: c.paymentToken,
        },
        { headers: this.headers() },
      )
      .catch((err: unknown) => this.handleError(err, 'Orange Money'));
    return {
      success: res.data.success,
      message: res.data.message,
      url: res.data.url,
      omUrl: res.data.other_url?.om_url,
      maxitUrl: res.data.other_url?.maxit_url,
    };
  }

  async payWithWave(c: SoftpayCustomer): Promise<SoftpayResult> {
    if (this.isDev()) return this.sandboxSimulate(c.paymentToken);
    const res = await axios
      .post<{ success: boolean; message: string; url?: string }>(
        `${this.baseUrl()}/softpay/wave-senegal`,
        {
          wave_senegal_fullName: c.customerName,
          wave_senegal_email: c.customerEmail,
          wave_senegal_phone: c.phone,
          wave_senegal_payment_token: c.paymentToken,
        },
        { headers: this.headers() },
      )
      .catch((err: unknown) => this.handleError(err, 'Wave'));
    return {
      success: res.data.success,
      message: res.data.message,
      url: res.data.url,
    };
  }

  async payWithFreeMoney(c: SoftpayCustomer): Promise<SoftpayResult> {
    if (this.isDev()) return this.sandboxSimulate(c.paymentToken);
    const res = await axios
      .post<{ success: boolean; message: string }>(
        `${this.baseUrl()}/softpay/free-money-senegal`,
        {
          customer_name: c.customerName,
          customer_email: c.customerEmail,
          phone_number: c.phone,
          payment_token: c.paymentToken,
        },
        { headers: this.headers() },
      )
      .catch((err: unknown) => this.handleError(err, 'Free Money'));
    return { success: res.data.success, message: res.data.message };
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

  private handleError(err: unknown, method: string): never {
    const axiosErr = err as {
      response?: { status: number; data: unknown };
      message?: string;
    };
    this.logger.error(
      `PayDunya SOFTPAY ${method} ERREUR — status: ${axiosErr.response?.status ?? 'N/A'} — body: ${JSON.stringify(axiosErr.response?.data ?? axiosErr.message)}`,
    );
    throw new BadRequestException('Payment service unavailable');
  }
}
