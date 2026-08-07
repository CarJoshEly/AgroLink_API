import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../database';
import { MailService } from '../mail';
import {
  BCRYPT_SALT_ROUNDS,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '../common/constants';
import { assertPasswordIsSafe } from '../common/utils';
import { JwtPayload } from '../common/interfaces';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterBuyerDto,
  RegisterSellerDto,
  ResetPasswordDto,
} from './dto';

type RequestMeta = { userAgent?: string; ipAddress?: string };

/** Convierte duraciones tipo "15m" / "7d" a milisegundos. */
function parseDurationMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  if (!match) return 7 * multipliers.d;
  return Number(match[1]) * multipliers[match[2]];
}

@Injectable()
export class AuthService {
  private readonly securityLogger = new Logger('Security');
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // --------------------------------------------------------------------
  // REGISTRO
  // --------------------------------------------------------------------

  async registerBuyer(dto: RegisterBuyerDto) {
    await this.assertEmailAvailable(dto.email);
    assertPasswordIsSafe(dto.password, [dto.name, dto.email]);

    const passwordHash = await this.hashPassword(dto.password);
    const { token, expiresAt } = await this.generateUniqueCode(
      EMAIL_VERIFICATION_TOKEN_TTL_MS,
      (code) => this.isEmailVerificationCodeTaken(code),
    );

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.CUSTOMER,
        emailVerificationToken: token,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    await this.mailService.sendVerificationEmail(user, token, dto.platform !== 'mobile');

    return {
      user: this.toSafeUser(user),
      message: 'Registro exitoso. Revisa tu correo para activar tu cuenta.',
      ...this.devTokenHint('verificationToken', token),
    };
  }

  async registerSeller(dto: RegisterSellerDto) {
    await this.assertEmailAvailable(dto.email);
    assertPasswordIsSafe(dto.password, [dto.name, dto.email, dto.businessName]);

    const existingDni = await this.prisma.sellerProfile.findUnique({ where: { dni: dto.dni } });
    if (existingDni) {
      throw new ConflictException('Ya existe un vendedor registrado con este DNI');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const { token, expiresAt } = await this.generateUniqueCode(
      EMAIL_VERIFICATION_TOKEN_TTL_MS,
      (code) => this.isEmailVerificationCodeTaken(code),
    );

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          role: UserRole.SELLER,
          emailVerificationToken: token,
          emailVerificationExpiresAt: expiresAt,
        },
      });

      await tx.location.create({
        data: {
          userId: created.id,
          departmentId: dto.departmentId,
          municipalityId: dto.municipalityId,
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isPrimary: true,
        },
      });

      await tx.sellerProfile.create({
        data: {
          userId: created.id,
          businessName: dto.businessName,
          dni: dto.dni,
        },
      });

      return created;
    });

    await this.mailService.sendVerificationEmail(user, token, dto.platform !== 'mobile');

    return {
      user: this.toSafeUser(user),
      message: 'Registro exitoso. Tu perfil de vendedor será revisado una vez verifiques tu correo.',
      ...this.devTokenHint('verificationToken', token),
    };
  }

  // --------------------------------------------------------------------
  // LOGIN / SESIONES
  // --------------------------------------------------------------------

  async login(dto: LoginDto, meta: RequestMeta) {
    // Incluye sellerProfile para que el front (web) pueda decidir a dónde
    // redirigir justo después del login (p. ej. `/vendedor/dashboard`) sin
    // tener que pedir `/users/me` aparte — antes venía `undefined` aquí y
    // un vendedor recién logueado caía en el home de comprador por error.
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { sellerProfile: true },
    });
    if (!user) {
      this.securityLogger.warn(`Intento de login con correo inexistente: ${dto.email} — ip=${meta.ipAddress}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) throw new ForbiddenException('Tu cuenta ha sido desactivada');
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Debes verificar tu correo antes de iniciar sesión');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Esta cuenta se creó con Google. Inicia sesión con el botón de Google, o usa "Olvidé mi contraseña" para crear una.',
      );
    }
    const passwordMatches = await this.comparePassword(dto.password, user.passwordHash);
    if (!passwordMatches) {
      this.securityLogger.warn(`Contraseña incorrecta para ${dto.email} — ip=${meta.ipAddress}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.issueTokens(user, meta);
    return { user: this.toSafeUser(user), ...tokens };
  }

  /**
   * "Continuar con Google" — sirve tanto para registrar como para iniciar
   * sesión con la MISMA llamada: si el correo (verificado por Google) ya
   * existe, entra a esa cuenta (vinculándola si aún no tenía `googleId`);
   * si no existe, crea una cuenta CUSTOMER nueva. Solo comprador — un
   * vendedor necesita teléfono/DNI/ubicación que Google no da, así que
   * sigue usando `registerSeller`. El ID token ya lo firmó Google, así que
   * no hace falta contraseña ni verificar el correo aparte.
   */
  async googleAuth(idToken: string, meta: RequestMeta) {
    const clientId = this.configService.get<string>('googleAuth.clientId');
    if (!clientId) {
      throw new InternalServerErrorException('El inicio de sesión con Google no está configurado');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google inválido o expirado');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Token de Google inválido');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Tu cuenta de Google no tiene el correo verificado');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: payload.email },
      include: { sellerProfile: true },
    });

    if (user) {
      if (!user.isActive) throw new ForbiddenException('Tu cuenta ha sido desactivada');
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
          include: { sellerProfile: true },
        });
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          name: payload.name ?? payload.email.split('@')[0],
          email: payload.email,
          avatarUrl: payload.picture,
          googleId: payload.sub,
          role: UserRole.CUSTOMER,
          emailVerifiedAt: new Date(),
        },
        include: { sellerProfile: true },
      });
    }

    const tokens = await this.issueTokens(user, meta);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) throw new UnauthorizedException('Refresh token inválido');

    if (stored.revokedAt) {
      // El token ya fue rotado/usado antes: posible robo. Se revoca todo.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.securityLogger.warn(
        `Reutilización de refresh token detectada — posible robo. userId=${stored.userId} ip=${meta.ipAddress}`,
      );
      throw new UnauthorizedException(
        'Refresh token inválido. Por seguridad, todas las sesiones han sido cerradas.',
      );
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario no válido');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user, meta);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Sesión cerrada correctamente' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Todas las sesiones han sido cerradas' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toSafeUser(user);
  }

  /** Verifica la contraseña de un usuario (reutilizado por otros módulos, p. ej. para confirmar la eliminación de una cuenta). */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) return false;
    return this.comparePassword(password, user.passwordHash);
  }

  // --------------------------------------------------------------------
  // CONTRASEÑAS
  // --------------------------------------------------------------------

  async forgotPassword(email: string, platform?: 'web' | 'mobile') {
    const user = await this.prisma.user.findUnique({ where: { email } });
    let token: string | undefined;
    if (user) {
      const generated = await this.generateUniqueCode(PASSWORD_RESET_TOKEN_TTL_MS, (code) =>
        this.isPasswordResetCodeTaken(code),
      );
      token = generated.token;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: generated.token, passwordResetExpiresAt: generated.expiresAt },
      });
      await this.mailService.sendPasswordResetEmail(user, generated.token, platform !== 'mobile');
    }
    // Respuesta genérica: no revela si el correo existe (evita user enumeration).
    return {
      message:
        'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.',
      ...(token ? this.devTokenHint('resetToken', token) : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: dto.token },
    });
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token de recuperación inválido o expirado');
    }
    assertPasswordIsSafe(dto.newPassword, [user.name, user.email]);

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Contraseña actualizada correctamente. Vuelve a iniciar sesión.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Esta cuenta no tiene contraseña todavía (se creó con Google) — usa "Olvidé mi contraseña" para crear una.',
      );
    }
    const matches = await this.comparePassword(dto.currentPassword, user.passwordHash);
    if (!matches) throw new UnauthorizedException('La contraseña actual no es correcta');
    assertPasswordIsSafe(dto.newPassword, [user.name, user.email]);

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  // --------------------------------------------------------------------
  // VERIFICACIÓN DE CORREO / ACTIVACIÓN DE CUENTA
  // --------------------------------------------------------------------

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });
    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token de verificación inválido o expirado');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    return { message: 'Correo verificado correctamente. Ya puedes iniciar sesión.' };
  }

  async resendVerification(email: string, platform?: 'web' | 'mobile') {
    const user = await this.prisma.user.findUnique({ where: { email } });
    let token: string | undefined;
    if (user && !user.emailVerifiedAt) {
      const generated = await this.generateUniqueCode(
        EMAIL_VERIFICATION_TOKEN_TTL_MS,
        (code) => this.isEmailVerificationCodeTaken(code),
      );
      token = generated.token;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: generated.token,
          emailVerificationExpiresAt: generated.expiresAt,
        },
      });
      await this.mailService.sendVerificationEmail(user, generated.token, platform !== 'mobile');
    }
    return {
      message:
        'Si el correo existe y no ha sido verificado, se ha enviado un nuevo enlace de activación.',
      ...(token ? this.devTokenHint('verificationToken', token) : {}),
    };
  }

  // --------------------------------------------------------------------
  // HELPERS PRIVADOS
  // --------------------------------------------------------------------

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo electrónico');
    }
  }

  private async issueTokens(user: User, meta: RequestMeta) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshTokenRaw = randomBytes(48).toString('hex');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshTokenRaw),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + parseDurationMs(refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken: refreshTokenRaw };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Código corto (6 dígitos) para pegar a mano — reemplaza el token largo
   * anterior (32 bytes al azar). `isTaken` revisa la columna `@unique`
   * correspondiente (email o password reset) porque, a diferencia de un
   * token largo, la colisión con otro código ya emitido deja de ser
   * astronómicamente improbable — se reintenta unas pocas veces antes de
   * rendirse.
   */
  private async generateUniqueCode(
    ttlMs: number,
    isTaken: (code: string) => Promise<boolean>,
  ): Promise<{ token: string; expiresAt: Date }> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = randomInt(0, 1_000_000).toString().padStart(6, '0');
      if (!(await isTaken(token))) {
        return { token, expiresAt: new Date(Date.now() + ttlMs) };
      }
    }
    throw new InternalServerErrorException(
      'No se pudo generar un código de verificación único. Intenta de nuevo.',
    );
  }

  private async isEmailVerificationCodeTaken(code: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { emailVerificationToken: code } });
    return count > 0;
  }

  private async isPasswordResetCodeTaken(code: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { passwordResetToken: code } });
    return count > 0;
  }

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  private comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private toSafeUser(user: User) {
    const {
      passwordHash: _passwordHash,
      emailVerificationToken: _evt,
      passwordResetToken: _prt,
      ...safe
    } = user;
    return safe;
  }

  /** En no-producción, devuelve el token en la respuesta para poder probar
   * el flujo sin un proveedor de correo real conectado todavía. */
  private devTokenHint(key: string, token: string): Record<string, string> {
    return process.env.NODE_ENV === 'production' ? {} : { [key]: token };
  }
}
