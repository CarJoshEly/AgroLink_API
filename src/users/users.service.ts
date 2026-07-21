import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationType, Prisma, User, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../database';
import { AuthService } from '../auth';
import { StorageService } from '../storage';
import { NotificationsService } from '../notifications';
import { AuditLogService } from '../audit';
import {
  DeleteAccountDto,
  ListSellersQueryDto,
  ListUsersQueryDto,
  RejectSellerDto,
  SuspendSellerDto,
  UpdateLocationDto,
  UpdateProfileDto,
} from './dto';

type IdentityFiles = {
  dniFront?: Express.Multer.File[];
  dniBack?: Express.Multer.File[];
  selfie?: Express.Multer.File[];
  lifeProof?: Express.Multer.File[];
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --------------------------------------------------------------------
  // PERFIL PROPIO
  // --------------------------------------------------------------------

  async getMyProfile(userId: string) {
    const user = await this.findUserOrThrow(userId, {
      locations: true,
      sellerProfile: { include: { identityVerification: true } },
    });
    return this.toSafeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone },
    });
    return this.toSafeUser(user);
  }

  async uploadAvatar(userId: string, file?: Express.Multer.File) {
    this.storageService.validateImage(file);
    const user = await this.findUserOrThrow(userId);
    const url = await this.storageService.uploadImage(file!, 'avatars');
    await this.storageService.deleteImage(user.avatarUrl);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });
    return this.toSafeUser(updated);
  }

  async upsertLocation(userId: string, dto: UpdateLocationDto) {
    const existing = await this.prisma.location.findFirst({
      where: { userId, isPrimary: true },
    });

    if (existing) {
      return this.prisma.location.update({
        where: { id: existing.id },
        data: { ...dto },
      });
    }

    return this.prisma.location.create({
      data: { ...dto, userId, isPrimary: true },
    });
  }

  async upsertIdentityVerification(userId: string, files: IdentityFiles) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: { identityVerification: true },
    });
    if (!sellerProfile) {
      throw new ForbiddenException('Solo los vendedores pueden enviar documentos de verificación');
    }

    const [dniFront, dniBack, selfie, lifeProof] = await Promise.all([
      this.uploadOrKeep(files.dniFront?.[0], 'identity', sellerProfile.identityVerification?.dniFrontUrl),
      this.uploadOrKeep(files.dniBack?.[0], 'identity', sellerProfile.identityVerification?.dniBackUrl),
      this.uploadOrKeep(files.selfie?.[0], 'identity', sellerProfile.identityVerification?.selfieUrl),
      this.uploadOrKeep(files.lifeProof?.[0], 'identity', sellerProfile.identityVerification?.lifeProofUrl),
    ]);

    if (!dniFront || !dniBack || !selfie || !lifeProof) {
      throw new BadRequestException(
        'Debes proporcionar las 4 fotografías: DNI frontal, DNI posterior, selfie y prueba de vida',
      );
    }

    const identityVerification = await this.prisma.identityVerification.upsert({
      where: { sellerProfileId: sellerProfile.id },
      update: {
        dniFrontUrl: dniFront,
        dniBackUrl: dniBack,
        selfieUrl: selfie,
        lifeProofUrl: lifeProof,
        status: VerificationStatus.PENDING,
        reviewedBy: null,
        reviewedAt: null,
        notes: null,
      },
      create: {
        sellerProfileId: sellerProfile.id,
        dniFrontUrl: dniFront,
        dniBackUrl: dniBack,
        selfieUrl: selfie,
        lifeProofUrl: lifeProof,
      },
    });

    // Reenvío tras un rechazo: vuelve a PENDING para una nueva revisión.
    if (sellerProfile.verificationStatus === VerificationStatus.REJECTED) {
      await this.prisma.sellerProfile.update({
        where: { id: sellerProfile.id },
        data: { verificationStatus: VerificationStatus.PENDING },
      });
    }

    return identityVerification;
  }

  async deleteOwnAccount(userId: string, dto: DeleteAccountDto) {
    const valid = await this.authService.verifyPassword(userId, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('La contraseña no es correcta');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date() },
    });
    await this.authService.logoutAll(userId);

    return { message: 'Tu cuenta ha sido eliminada' };
  }

  // --------------------------------------------------------------------
  // ADMINISTRACIÓN DE USUARIOS
  // --------------------------------------------------------------------

  async listUsers(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => this.toSafeUser(u)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getUserById(id: string) {
    const user = await this.findUserOrThrow(id, {
      locations: true,
      sellerProfile: { include: { identityVerification: true } },
    });
    return this.toSafeUser(user);
  }

  async setUserActive(id: string, isActive: boolean, adminId: string) {
    const previous = await this.findUserOrThrow(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive } });
    if (!isActive) await this.authService.logoutAll(id);

    await this.auditLogService.log(
      adminId,
      isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      'User',
      id,
      { isActive: previous.isActive },
      { isActive },
    );

    return this.toSafeUser(user);
  }

  async deleteUser(id: string, adminId: string) {
    await this.findUserOrThrow(id);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await this.authService.logoutAll(id);

    await this.auditLogService.log(adminId, 'USER_DELETED', 'User', id);

    return { message: 'Usuario eliminado' };
  }

  // --------------------------------------------------------------------
  // PANEL DE VERIFICACIÓN DE VENDEDORES
  // --------------------------------------------------------------------

  async listSellers(query: ListSellersQueryDto) {
    const where: Prisma.SellerProfileWhereInput = {
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { businessName: { contains: query.search, mode: 'insensitive' } },
              { dni: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.sellerProfile.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        include: { user: true, identityVerification: true },
      }),
      this.prisma.sellerProfile.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async getSellerById(id: string) {
    return this.findSellerOrThrow(id);
  }

  async markSellerUnderReview(id: string, adminId: string) {
    const seller = await this.findSellerOrThrow(id);
    return this.transitionSeller(seller, adminId, VerificationStatus.UNDER_REVIEW, {
      action: 'SELLER_MARKED_UNDER_REVIEW',
    });
  }

  async approveSeller(id: string, adminId: string) {
    const seller = await this.findSellerOrThrow(id);
    return this.transitionSeller(seller, adminId, VerificationStatus.VERIFIED, {
      action: 'SELLER_APPROVED',
      notificationType: NotificationType.SELLER_APPROVED,
      notificationTitle: 'Cuenta de vendedor aprobada',
      notificationMessage: 'Tu perfil de vendedor ha sido verificado. Ya puedes publicar productos.',
      extraSellerData: { verifiedAt: new Date(), verifiedBy: adminId },
    });
  }

  async rejectSeller(id: string, adminId: string, dto: RejectSellerDto) {
    const seller = await this.findSellerOrThrow(id);
    return this.transitionSeller(seller, adminId, VerificationStatus.REJECTED, {
      action: 'SELLER_REJECTED',
      notificationType: NotificationType.SELLER_REJECTED,
      notificationTitle: 'Verificación rechazada',
      notificationMessage: `Tu documentación no pudo ser validada: ${dto.reason}`,
      identityNotes: dto.reason,
    });
  }

  async suspendSeller(id: string, adminId: string, dto: SuspendSellerDto) {
    const seller = await this.findSellerOrThrow(id);
    const result = await this.transitionSeller(seller, adminId, VerificationStatus.SUSPENDED, {
      action: 'SELLER_SUSPENDED',
      notificationType: NotificationType.SELLER_SUSPENDED,
      notificationTitle: 'Cuenta de vendedor suspendida',
      notificationMessage: `Tu cuenta de vendedor ha sido suspendida: ${dto.reason}`,
      extraSellerData: { suspendedReason: dto.reason },
    });
    await this.authService.logoutAll(seller.userId);
    return result;
  }

  // --------------------------------------------------------------------
  // HELPERS PRIVADOS
  // --------------------------------------------------------------------

  private async transitionSeller(
    seller: Prisma.SellerProfileGetPayload<{ include: { identityVerification: true; user: true } }>,
    adminId: string,
    newStatus: VerificationStatus,
    opts: {
      action: string;
      notificationType?: NotificationType;
      notificationTitle?: string;
      notificationMessage?: string;
      extraSellerData?: Record<string, unknown>;
      identityNotes?: string;
    },
  ) {
    const previousStatus = seller.verificationStatus;

    const updatedSeller = await this.prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { verificationStatus: newStatus, ...(opts.extraSellerData ?? {}) },
    });

    if (seller.identityVerification) {
      await this.prisma.identityVerification.update({
        where: { id: seller.identityVerification.id },
        data: {
          status: newStatus,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          notes: opts.identityNotes ?? seller.identityVerification.notes,
        },
      });
    }

    await this.auditLogService.log(
      adminId,
      opts.action,
      'SellerProfile',
      seller.id,
      { verificationStatus: previousStatus },
      { verificationStatus: newStatus },
    );

    if (opts.notificationType) {
      await this.notificationsService.create(
        seller.userId,
        opts.notificationType,
        opts.notificationTitle ?? '',
        opts.notificationMessage ?? '',
      );
    }

    return updatedSeller;
  }

  private async uploadOrKeep(
    file: Express.Multer.File | undefined,
    pathPrefix: string,
    existingUrl?: string | null,
  ): Promise<string | undefined> {
    if (file) {
      if (existingUrl) await this.storageService.deleteImage(existingUrl);
      return this.storageService.uploadImage(file, pathPrefix);
    }
    return existingUrl ?? undefined;
  }

  private async findUserOrThrow(id: string, include?: Prisma.UserInclude) {
    const user = await this.prisma.user.findUnique({ where: { id }, include });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async findSellerOrThrow(id: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { id },
      include: { identityVerification: true, user: true },
    });
    if (!seller) throw new NotFoundException('Vendedor no encontrado');
    return seller;
  }

  private toSafeUser(user: User) {
    const {
      passwordHash: _passwordHash,
      emailVerificationToken: _evt,
      passwordResetToken: _prt,
      ...safe
    } = user as User & Record<string, unknown>;
    return safe;
  }
}
