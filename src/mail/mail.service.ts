import { Injectable, Logger } from '@nestjs/common';

type MailUser = { email: string; name: string };

/**
 * Abstracción de envío de correo. Por ahora solo registra el contenido en
 * el log (no hay proveedor de correo configurado todavía); reemplazar el
 * cuerpo de los métodos privados por un proveedor real (Resend, SMTP, etc.)
 * no requiere tocar a quienes la consumen.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationEmail(user: MailUser, token: string): Promise<void> {
    const link = `https://agrolink.hn/verificar-correo?token=${token}`;
    this.dispatch(
      user.email,
      'Verifica tu correo — AgroLink Honduras',
      `Hola ${user.name}, activa tu cuenta aquí: ${link}`,
    );
  }

  async sendPasswordResetEmail(user: MailUser, token: string): Promise<void> {
    const link = `https://agrolink.hn/restablecer-contrasena?token=${token}`;
    this.dispatch(
      user.email,
      'Recupera tu contraseña — AgroLink Honduras',
      `Hola ${user.name}, restablece tu contraseña aquí: ${link}`,
    );
  }

  private dispatch(to: string, subject: string, body: string): void {
    this.logger.log(`📧 Para: ${to} | Asunto: ${subject}\n${body}`);
  }
}
