import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir el acceso a un endpoint por rol.
 * Uso: @Roles(UserRole.ADMIN, UserRole.SELLER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
