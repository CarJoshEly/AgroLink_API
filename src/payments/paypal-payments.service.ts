import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartService } from '../cart';
import { OrdersService } from '../orders';
import { TransactionsService } from '../finance';
import { PaypalClientService } from './paypal-client.service';

export interface CreatePaypalOrderResult {
  paypalOrderId: string;
  approveUrl: string;
  totalHnl: number;
  totalUsd: number;
}

@Injectable()
export class PaypalPaymentsService {
  constructor(
    private readonly paypalClient: PaypalClientService,
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService,
    private readonly transactionsService: TransactionsService,
    private readonly configService: ConfigService,
  ) {}

  private get exchangeRate(): number {
    return this.configService.get<number>('paypal.hnlToUsdRate') ?? 24.7;
  }

  private get returnUrl(): string {
    const publicUrl = this.configService.get<string>('app.publicUrl');
    const prefix = this.configService.get<string>('app.apiPrefix');
    const version = this.configService.get<string>('app.apiVersion');
    return `${publicUrl}/${prefix}/${version}/payments/paypal/return`;
  }

  private get cancelUrl(): string {
    const publicUrl = this.configService.get<string>('app.publicUrl');
    const prefix = this.configService.get<string>('app.apiPrefix');
    const version = this.configService.get<string>('app.apiVersion');
    return `${publicUrl}/${prefix}/${version}/payments/paypal/cancel`;
  }

  /**
   * El monto SIEMPRE se calcula acá a partir del carrito real en el
   * servidor — nunca se confía en un total que mande el cliente (web o
   * móvil), porque ese número es exactamente lo que PayPal termina
   * cobrando.
   */
  async createCheckoutOrder(buyerId: string): Promise<CreatePaypalOrderResult> {
    const cart = await this.cartService.getCart(buyerId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Tu carrito está vacío');
    }

    const totalHnl = cart.total as number;
    const totalUsd = Number((totalHnl / this.exchangeRate).toFixed(2));
    if (totalUsd <= 0) {
      throw new BadRequestException('El total del carrito no es válido para procesar un pago');
    }

    const { paypalOrderId, approveUrl } = await this.paypalClient.createOrder({
      amountUsd: totalUsd.toFixed(2),
      referenceId: buyerId,
      returnUrl: this.returnUrl,
      cancelUrl: this.cancelUrl,
    });

    return { paypalOrderId, approveUrl, totalHnl, totalUsd };
  }

  /**
   * Captura el pago en PayPal y, solo si PayPal confirma `COMPLETED`,
   * genera la(s) solicitud(es) de compra reusando la misma lógica que el
   * checkout normal (`OrdersService.checkout`) — un pedido por vendedor,
   * descuento de stock incluido. Si la captura falla, no se crea ningún
   * pedido y el carrito queda intacto para reintentar.
   */
  async captureCheckoutOrder(buyerId: string, paypalOrderId: string) {
    const capture = await this.paypalClient.captureOrder(paypalOrderId);
    if (capture.status !== 'COMPLETED') {
      throw new BadRequestException(`El pago de PayPal no se completó (estado: ${capture.status})`);
    }

    const orders = await this.ordersService.checkout(buyerId);

    for (const order of orders) {
      await this.transactionsService.recordCompletedPaypalPayment(order, capture.id);
    }

    return orders;
  }
}
