import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database';
import { MailService } from '../mail';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { AuthService } from './auth.service';

jest.mock('bcryptjs');

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

const baseUser = {
  id: 'user-1',
  name: 'María Fernández',
  email: 'maria@example.com',
  phone: '99887766',
  avatarUrl: null,
  passwordHash: 'hashed-password',
  role: UserRole.CUSTOMER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  emailVerifiedAt: new Date(),
  emailVerificationToken: null,
  emailVerificationExpiresAt: null,
  passwordResetToken: null,
  passwordResetExpiresAt: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let mailService: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };
  const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' };

  beforeEach(async () => {
    prisma = createPrismaMock();
    mailService = { sendVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('signed-jwt') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('7d') } },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('inicia sesión correctamente con credenciales válidas', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as any);
      bcryptMock.compare.mockResolvedValue(true as never);
      prisma.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.login({ email: baseUser.email, password: 'Segura123' }, meta);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('rechaza un correo inexistente y registra el intento como evento de seguridad', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nadie@example.com', password: 'x' }, meta),
      ).rejects.toThrow(UnauthorizedException);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('inexistente'));
    });

    it('rechaza una contraseña incorrecta y registra el intento como evento de seguridad', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as any);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        service.login({ email: baseUser.email, password: 'incorrecta' }, meta),
      ).rejects.toThrow(UnauthorizedException);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('Contraseña incorrecta'));
    });

    it('rechaza una cuenta desactivada', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, isActive: false } as any);

      await expect(service.login({ email: baseUser.email, password: 'x' }, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza una cuenta sin correo verificado', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, emailVerifiedAt: null } as any);

      await expect(service.login({ email: baseUser.email, password: 'x' }, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('refresh', () => {
    it('rota el refresh token y emite nuevos tokens', async () => {
      const stored = {
        id: 'rt-1',
        userId: baseUser.id,
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      };
      prisma.refreshToken.findUnique.mockResolvedValue(stored as any);
      prisma.user.findUnique.mockResolvedValue(baseUser as any);
      prisma.refreshToken.update.mockResolvedValue({} as any);
      prisma.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.refresh('raw-refresh-token', meta);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' } }),
      );
      expect(result.accessToken).toBe('signed-jwt');
    });

    it('detecta la reutilización de un token ya revocado y cierra todas las sesiones', async () => {
      const stored = {
        id: 'rt-1',
        userId: baseUser.id,
        tokenHash: 'hash',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      };
      prisma.refreshToken.findUnique.mockResolvedValue(stored as any);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 } as any);

      await expect(service.refresh('raw-refresh-token', meta)).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: baseUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('posible robo'));
    });
  });

  describe('registerBuyer / registerSeller', () => {
    it('rechaza el registro si el correo ya existe', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as any);

      await expect(
        service.registerBuyer({
          name: 'Nuevo',
          email: baseUser.email,
          password: 'Segura123',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza el registro de vendedor si el DNI ya existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.sellerProfile.findUnique.mockResolvedValue({ id: 'sp-1' } as any);

      await expect(
        service.registerSeller({
          name: 'Vendedor',
          email: 'vendedor@example.com',
          phone: '99887766',
          password: 'Segura123',
          businessName: 'Finca X',
          dni: '0801-1995-04521',
          departmentId: 'dep-1',
          municipalityId: 'mun-1',
          address: 'Barrio El Centro',
          latitude: 14.07,
          longitude: -87.19,
          dniFrontUrl: 'https://x/1.jpg',
          dniBackUrl: 'https://x/2.jpg',
          selfieUrl: 'https://x/3.jpg',
          lifeProofUrl: 'https://x/4.jpg',
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('rechaza el cambio si la contraseña actual no coincide', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as any);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        service.changePassword(baseUser.id, { currentPassword: 'mala', newPassword: 'NuevaSegura123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('actualiza la contraseña y revoca las sesiones activas cuando la actual es correcta', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as any);
      bcryptMock.compare.mockResolvedValue(true as never);
      bcryptMock.hash.mockResolvedValue('nuevo-hash' as never);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.changePassword(baseUser.id, {
        currentPassword: 'Segura123',
        newPassword: 'NuevaSegura123',
      });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: baseUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.message).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('retorna false si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.verifyPassword('no-existe', 'x')).resolves.toBe(false);
    });

    it('delega la comparación de contraseña en bcrypt cuando el usuario existe', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser as any);
      bcryptMock.compare.mockResolvedValue(true as never);
      await expect(service.verifyPassword(baseUser.id, 'Segura123')).resolves.toBe(true);
    });
  });
});
