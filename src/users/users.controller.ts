import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { MAX_IMAGE_SIZE } from '../common/constants';
import { UsersService } from './users.service';
import {
  DeleteAccountDto,
  ListUsersQueryDto,
  UpdateLocationDto,
  UpdateProfileDto,
} from './dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ---- Perfil propio (rutas literales primero, antes de /:id) ----

  @Get('me')
  @ApiOperation({ summary: 'Obtener mi perfil completo' })
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyProfile(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar mi perfil (nombre, teléfono)' })
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir mi fotografía de perfil' })
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  uploadAvatar(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.uploadAvatar(user.sub, file);
  }

  @Put('me/location')
  @ApiOperation({ summary: 'Crear o actualizar mi ubicación principal' })
  upsertLocation(@CurrentUser() user: JwtPayload, @Body() dto: UpdateLocationDto) {
    return this.usersService.upsertLocation(user.sub, dto);
  }

  @Put('me/identity-verification')
  @Roles(UserRole.SELLER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar/actualizar documentos de verificación (DNI, selfie, prueba de vida)' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'dniFront', maxCount: 1 },
        { name: 'dniBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
        { name: 'lifeProof', maxCount: 1 },
      ],
      { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE } },
    ),
  )
  uploadIdentityVerification(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles()
    files: {
      dniFront?: Express.Multer.File[];
      dniBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      lifeProof?: Express.Multer.File[];
    },
  ) {
    return this.usersService.upsertIdentityVerification(user.sub, files);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Eliminar mi cuenta' })
  deleteOwnAccount(@CurrentUser() user: JwtPayload, @Body() dto: DeleteAccountDto) {
    return this.usersService.deleteOwnAccount(user.sub, dto);
  }

  // ---- Administración de usuarios ----

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar usuarios (admin)' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ver el detalle de un usuario (admin)' })
  getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activar un usuario (admin)' })
  activateUser(@Param('id') id: string) {
    return this.usersService.setUserActive(id, true);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Desactivar un usuario (admin)' })
  deactivateUser(@Param('id') id: string) {
    return this.usersService.setUserActive(id, false);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar un usuario (admin)' })
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
