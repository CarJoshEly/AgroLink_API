import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { lookup } from 'node:dns/promises';

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;

type MailUser = { email: string; name: string };

type SellerSubmission = {
  sellerId: string;
  businessName: string;
  dni: string;
  sellerName: string;
  sellerEmail: string;
};

/**
 * Envío de correo vía SMTP de Gmail con la cuenta del proyecto
 * (agrolink.hn@gmail.com). Si no hay `GMAIL_USER`/`GMAIL_APP_PASSWORD`
 * configuradas (p.ej. en la máquina de otro dev del equipo que no tiene el
 * secreto), cae de vuelta a solo loguear el contenido — así nadie queda
 * bloqueado por no tener la contraseña de aplicación, a costa de no recibir
 * el correo de verdad.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly gmailUser?: string;
  private readonly gmailAppPassword?: string;
  private readonly fromAddress: string;
  private readonly webAppUrl: string;
  private readonly adminEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.gmailUser = this.configService.get<string>('mail.gmailUser');
    this.gmailAppPassword = this.configService.get<string>('mail.gmailAppPassword');
    this.fromAddress = this.configService.get<string>('mail.fromAddress')!;
    this.webAppUrl = this.configService.get<string>('mail.webAppUrl')!;
    this.adminEmail = this.configService.get<string>('mail.adminEmail')!;

    if (!this.gmailUser || !this.gmailAppPassword) {
      this.logger.warn(
        'GMAIL_USER / GMAIL_APP_PASSWORD no configuradas — los correos solo se registrarán en el log.',
      );
    }
  }

  /**
   * `smtp.gmail.com` resuelve a IPv4 e IPv6. El resolutor propio de
   * nodemailer (`dns.resolve4`/`resolve6`, consultas DNS directas) devuelve
   * en Render solo la dirección IPv6, que no tiene ruta de salida
   * (ENETUNREACH) — el resolutor del sistema operativo (`dns.lookup`, el
   * mismo que usa cualquier otro cliente HTTP) sí resuelve IPv4
   * correctamente. Se resuelve acá y se conecta directo a la IP en vez de
   * dejar que nodemailer intente resolver el hostname él mismo.
   */
  private async createTransporter(): Promise<Transporter | null> {
    if (!this.gmailUser || !this.gmailAppPassword) return null;

    let host: string = SMTP_HOST;
    try {
      const resolved = await lookup(SMTP_HOST, { family: 4 });
      host = resolved.address;
    } catch (err) {
      this.logger.warn(
        `No se pudo resolver ${SMTP_HOST} a IPv4 de antemano (${(err as Error).message}) — se usa el hostname tal cual.`,
      );
    }

    return createTransport({
      // Host/puerto explícitos (587 + STARTTLS) en vez del preset
      // `service: 'gmail'` (fuerza 465/TLS implícito) — algunos hosts
      // bloquean 465 saliente pero dejan pasar 587. Timeouts cortos a
      // propósito: si el puerto igual está bloqueado, que falle rápido
      // y se registre en el catch de `dispatch()` en vez de colgar la
      // request hasta que el TimeoutInterceptor global (30s) la corte
      // con un 408 que no dice nada del motivo real.
      host,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: this.gmailUser, pass: this.gmailAppPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
      // Se conecta por IP, no por hostname — sin esto el certificado TLS de
      // Gmail (emitido para "smtp.gmail.com") no coincide con la IP y falla
      // la validación.
      tls: { servername: SMTP_HOST },
    });
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

    try {
      const transporter = await this.createTransporter();
      if (!transporter) return;

      // nodemailer tipa `SentMessageInfo` como `any` (ver @types/nodemailer) —
      // se afirma la forma mínima que de verdad se usa para no propagar `any`.
      const info = (await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text: body,
      })) as { messageId?: string };
      this.logger.log(`Correo enviado a ${to} (messageId: ${info.messageId})`);
    } catch (err) {
      // Un correo que falla no debe tumbar el flujo que lo dispara (registro,
      // forgot-password, etc.) — esos endpoints ya devuelven el token en modo
      // desarrollo como respaldo.
      //
      // `Logger.error(message, trace)` espera un STRING en `trace` — pasarle
      // el objeto Error directo (como estaba antes) lo deja fuera del log
      // por el mismatch de tipo, así que en producción nunca se veía el
      // motivo real del fallo (auth, conexión, etc.), solo esta línea vacía.
      const error = err as Error & { code?: string; response?: string; responseCode?: number };
      this.logger.error(
        `Error enviando correo a ${to}: ${error.message} ` +
          `(code=${error.code ?? 'n/a'}, responseCode=${error.responseCode ?? 'n/a'}, response=${error.response ?? 'n/a'})`,
        error.stack,
      );
    }
  }
}
