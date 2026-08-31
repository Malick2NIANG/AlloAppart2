import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
   * En sandbox, PayDunya n'expose PAS les endpoints par opérateur
   * (softpay/new-orange-money-senegal, softpay/wave-senegal, etc.) — ce sont
   * des chemins réservés au mode LIVE. Le test en sandbox passe par un
   * unique endpoint générique simulant n'importe quel moyen de paiement,
   * authentifié avec un compte de test PayDunya (email/téléphone/mot de
   * passe), configuré via PAYDUNYA_TEST_EMAIL / _PHONE / _PASSWORD.
   * Voir https://developers.paydunya.com/doc/FR/sandbox_softpay
   */
  private async sandboxSimulate(paymentToken: string): Promise<SoftpayResult> {
    const email = this.config.get<string>('PAYDUNYA_TEST_EMAIL');
    const phone = this.config.get<string>('PAYDUNYA_TEST_PHONE');
    const password = this.config.get<string>('PAYDUNYA_TEST_PASSWORD');
    if (!email || !phone || !password) {
      this.logger.error(
        'PAYDUNYA_TEST_EMAIL/_PHONE/_PASSWORD manquants — nécessaires pour simuler un paiement SOFTPAY en sandbox (voir doc PayDunya Sandbox SoftPay).',
      );
      throw new BadRequestException(
        'Simulation de paiement indisponible en environnement de test (compte de test PayDunya non configuré).',
      );
    }
    const res = await axios
      .post<{ success: boolean; message: string }>(
        `${this.baseUrl()}/softpay/checkout/make-payment`,
        {
          phone_phone: phone,
          customer_email: email,
          password,
          invoice_token: paymentToken,
        },
        { headers: this.headers() },
      )
      .catch((err: unknown) => this.handleError(err, 'Sandbox simulate'));
    return { success: res.data.success, message: res.data.message };
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
