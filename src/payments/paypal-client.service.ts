import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PaypalLink {
  href: string;
  rel: string;
  method: string;
}

interface PaypalCreateOrderResponse {
  id: string;
  status: string;
  links: PaypalLink[];
}

export interface PaypalCaptureResult {
  id: string;
  status: string;
}

/**
 * Cliente crudo de la API REST de PayPal (Orders v2 + OAuth2 client
 * credentials). Nada de SDK oficial: PayPal lo descontinuó para Node hace
 * tiempo y para 2 llamadas (`create` + `capture`) no vale la pena la
 * dependencia — `fetch` global (Node 24) ya se usa igual en
 * `google-maps.service.ts`.
 */
@Injectable()
export class PaypalClientService {
  private readonly logger = new Logger(PaypalClientService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get clientId(): string | undefined {
    return this.configService.get<string>('paypal.clientId');
  }

  private get secret(): string | undefined {
    return this.configService.get<string>('paypal.secret');
  }

  private get baseUrl(): string {
    const mode = this.configService.get<string>('paypal.mode');
    return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private ensureConfigured(): void {
    const placeholder = (value: string | undefined) => !value || value.startsWith('tu_');
    if (placeholder(this.clientId) || placeholder(this.secret)) {
      throw new ServiceUnavailableException(
        'PayPal no está configurado en este ambiente (falta PAYPAL_CLIENT_ID/PAYPAL_SECRET reales en .env)',
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    this.ensureConfigured();
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.secret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      this.logger.error(`OAuth de PayPal falló (${response.status}): ${await response.text()}`);
      throw new ServiceUnavailableException('No se pudo autenticar con PayPal');
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    // Restar 60s de margen para no usar un token que expira a mitad de la petición siguiente.
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return this.cachedToken.value;
  }

  async createOrder(params: {
    amountUsd: string;
    referenceId: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ paypalOrderId: string; approveUrl: string }> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: params.referenceId,
            amount: { currency_code: 'USD', value: params.amountUsd },
          },
        ],
        application_context: {
          brand_name: 'AgroLink Honduras',
          user_action: 'PAY_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      }),
    });

    const data = (await response.json()) as PaypalCreateOrderResponse;
    if (!response.ok) {
      this.logger.error(`createOrder de PayPal falló (${response.status}): ${JSON.stringify(data)}`);
      throw new BadRequestException('No se pudo crear la orden de pago en PayPal');
    }

    const approveLink = data.links?.find((link) => link.rel === 'approve' || link.rel === 'payer-action');
    if (!approveLink) {
      throw new BadRequestException('PayPal no devolvió un enlace de aprobación para esta orden');
    }

    return { paypalOrderId: data.id, approveUrl: approveLink.href };
  }

  async captureOrder(paypalOrderId: string): Promise<PaypalCaptureResult> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    const data = (await response.json()) as PaypalCaptureResult;
    if (!response.ok) {
      this.logger.error(`captureOrder de PayPal falló (${response.status}): ${JSON.stringify(data)}`);
      throw new BadRequestException(
        'No se pudo capturar el pago en PayPal (¿ya fue capturado o fue cancelado?)',
      );
    }

    return data;
  }
}
