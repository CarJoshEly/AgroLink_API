import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

type MailUser = { email: string; name: string };

type SellerSubmission = {
  sellerId: string;
  businessName: string;
  dni: string;
  sellerName: string;
  sellerEmail: string;
};

/** Separa `"AgroLink Honduras <agrolink.hn@gmail.com>"` en nombre + correo — la
 * API de Brevo pide el remitente como campos separados, no como un solo string. */
function parseFromAddress(raw: string): { name?: string; email: string } {
  const match = raw.match(/^(.*)<(.+)>$/);
  if (!match) return { email: raw.trim() };
  return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
}

/**
 * Envío de correo vía la API HTTPS de Brevo (brevo.com, capa gratuita: 300
 * correos/día). Se eligió sobre SMTP directo porque el SMTP saliente de
 * Gmail desde Render resultó poco confiable — bloqueos y timeouts
 * intermitentes hacia smtp.gmail.com (IPv6 sin ruta, luego IPv4 con
 * timeout — típico de anti-abuso de Gmail contra IPs de hosting en la
 * nube). Una API por HTTPS (puerto 443) no tiene ese problema.
 *
 * Si no hay `BREVO_API_KEY` configurada (p.ej. en la máquina de otro dev del
 * equipo que no tiene el secreto), cae de vuelta a solo loguear el
 * contenido — así nadie queda bloqueado por no tener la clave, a costa de
 * no recibir el correo de verdad.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey?: string;
  private readonly sender: { name?: string; email: string };
  private readonly webAppUrl: string;
  private readonly adminEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('mail.brevoApiKey');
    this.sender = parseFromAddress(this.configService.get<string>('mail.fromAddress')!);
    this.webAppUrl = this.configService.get<string>('mail.webAppUrl')!;
    this.adminEmail = this.configService.get<string>('mail.adminEmail')!;

    if (!this.apiKey) {
      this.logger.warn('BREVO_API_KEY no configurada — los correos solo se registrarán en el log.');
    }
  }

  /**
   * Incluye el token tanto en el link (para quien abra el correo desde la
   * web, donde `${webAppUrl}/verificar-email` lo valida solo) como en texto
   * plano aparte (para quien esté en la app móvil, que no tiene forma de
   * abrir ese link dentro de la app — debe copiar/pegar el código a mano en
   * la pantalla de verificación).
   */
  async sendVerificationEmail(user: MailUser, token: string): Promise<void> {
    const link = `${this.webAppUrl}/verificar-email?token=${token}`;
    await this.dispatch(
      user.email,
      'Verifica tu correo — AgroLink Honduras',
      `Hola ${user.name}, activa tu cuenta aquí: ${link}\n\n` +
        `¿Estás en la app móvil? Copia este código y pégalo en la pantalla de verificación:\n${token}`,
    );
  }

  async sendPasswordResetEmail(user: MailUser, token: string): Promise<void> {
    const link = `${this.webAppUrl}/restablecer-password?token=${token}`;
    await this.dispatch(
      user.email,
      'Recupera tu contraseña — AgroLink Honduras',
      `Hola ${user.name}, restablece tu contraseña aquí: ${link}\n\n` +
        `¿Estás en la app móvil? Copia este código y pégalo en la pantalla de restablecimiento:\n${token}`,
    );
  }

  /** Aviso al equipo (bandeja de administración) de que un vendedor envió
   * (o reenvió) sus documentos y está esperando revisión manual. */
  async sendSellerVerificationSubmittedEmail(submission: SellerSubmission): Promise<void> {
    const link = `${this.webAppUrl}/admin/vendedores/${submission.sellerId}`;
    await this.dispatch(
      this.adminEmail,
      `Nueva solicitud de verificación — ${submission.businessName}`,
      `${submission.sellerName} (${submission.sellerEmail}) envió sus documentos de identidad ` +
        `para el negocio "${submission.businessName}" (DNI ${submission.dni}).\n\n` +
        `Revísalos aquí: ${link}`,
    );
  }

  /** Aviso al vendedor de que un admin aprobó, rechazó o suspendió su
   * verificación — mismo texto que ya se guarda como notificación in-app,
   * solo que este sí llega aunque nunca abra la app/web. */
  async sendSellerVerificationStatusEmail(
    user: MailUser,
    subject: string,
    message: string,
  ): Promise<void> {
    await this.dispatch(
      user.email,
      `${subject} — AgroLink Honduras`,
      `Hola ${user.name}, ${message}`,
    );
  }

  private async dispatch(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`📧 Para: ${to} | Asunto: ${subject}\n${body}`);
    if (!this.apiKey) return;

    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: to }],
          subject,
          textContent: body,
        }),
        // Petición HTTPS normal — no debería tardar más que cualquier otra
        // llamada a una API externa. Si Brevo está caído, que falle rápido
        // en vez de colgar la request hasta el TimeoutInterceptor global.
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '<no se pudo leer el cuerpo>');
        throw new Error(`Brevo respondió ${response.status}: ${errorBody}`);
      }

      const info = (await response.json()) as { messageId?: string };
      this.logger.log(`Correo enviado a ${to} (messageId: ${info.messageId})`);
    } catch (err) {
      // Un correo que falla no debe tumbar el flujo que lo dispara (registro,
      // forgot-password, etc.) — esos endpoints ya devuelven el token en modo
      // desarrollo como respaldo.
      const error = err as Error;
      this.logger.error(`Error enviando correo a ${to}: ${error.message}`, error.stack);
    }
  }
}
