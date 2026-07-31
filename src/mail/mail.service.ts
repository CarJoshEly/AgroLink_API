import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

type MailUser = { email: string; name: string };

/**
 * Envío de correo vía Resend. Si no hay `RESEND_API_KEY` configurada (p.ej.
 * en la máquina de otro dev del equipo que no tiene una cuenta propia), cae
 * de vuelta a solo loguear el contenido — así nadie queda bloqueado por no
 * tener el secreto, a costa de no recibir el correo de verdad.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('mail.resendApiKey');
    this.fromAddress = this.configService.get<string>('mail.fromAddress')!;
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — los correos solo se registrarán en el log.',
      );
    }
  }

  async sendVerificationEmail(user: MailUser, token: string): Promise<void> {
    const link = `https://agrolink.hn/verificar-correo?token=${token}`;
    await this.dispatch(
      user.email,
      'Verifica tu correo — AgroLink Honduras',
      `Hola ${user.name}, activa tu cuenta aquí: ${link}`,
    );
  }

  async sendPasswordResetEmail(user: MailUser, token: string): Promise<void> {
    const link = `https://agrolink.hn/restablecer-contrasena?token=${token}`;
    await this.dispatch(
      user.email,
      'Recupera tu contraseña — AgroLink Honduras',
      `Hola ${user.name}, restablece tu contraseña aquí: ${link}`,
    );
  }

  private async dispatch(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`📧 Para: ${to} | Asunto: ${subject}\n${body}`);
    if (!this.resend) return;

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        text: body,
      });
      if (error) {
        this.logger.error(`Resend rechazó el envío a ${to}: ${error.message}`);
      }
    } catch (err) {
      // Un correo que falla no debe tumbar el flujo que lo dispara (registro,
      // forgot-password, etc.) — esos endpoints ya devuelven el token en modo
      // desarrollo como respaldo.
      this.logger.error(`Error inesperado enviando correo a ${to}`, err as Error);
    }
  }
}
