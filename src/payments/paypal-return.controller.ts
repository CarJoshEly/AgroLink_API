import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators';

function landingPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — AgroLink Honduras</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f4f6f2; color: #1f2a1a; display: flex;
           min-height: 100vh; align-items: center; justify-content: center; margin: 0; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 360px; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { font-size: 0.9rem; color: #55604a; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

/**
 * Páginas de aterrizaje del checkout de PayPal redirigido (`return_url` /
 * `cancel_url`, ver paypal-payments.service.ts). En el flujo normal, el
 * WebView de la app móvil intercepta la navegación hacia estas rutas ANTES
 * de que lleguen a cargar (ver `PaypalCheckoutScreen` en AgroLink_MOVIL) y
 * dispara la captura del pago desde la app — esto es solo el respaldo para
 * cuando la interceptación no alcanza a tiempo o alguien abre el enlace en
 * un navegador normal.
 */
@ApiExcludeController()
@Controller('payments/paypal')
export class PaypalReturnController {
  @Get('return')
  @Public()
  returnPage(@Res() res: Response) {
    res
      .type('html')
      .send(
        landingPage(
          'Pago aprobado',
          'Ya puedes volver a la app de AgroLink Honduras para terminar tu compra.',
        ),
      );
  }

  @Get('cancel')
  @Public()
  cancelPage(@Res() res: Response) {
    res
      .type('html')
      .send(landingPage('Pago cancelado', 'No se realizó ningún cobro. Puedes volver a la app.'));
  }
}
