import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import {
  ApiCommonErrorResponses,
  ApiCreatedResponseData,
  ApiOkResponseData,
  CurrentUser,
  Public,
  Roles,
} from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { MAX_IMAGE_SIZE } from '../common/constants';
import { imageFileFilter } from '../common/utils';
import { ProductsService } from './products.service';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto, UpdateStockDto } from './dto';

@ApiTags('Products')
@ApiCommonErrorResponses()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Buscar productos (marketplace público)' })
  @ApiOkResponseData()
  findMany(@Query() query: ListProductsQueryDto) {
    return this.productsService.findMany(query);
  }

  @Get('mine')
  @Roles(UserRole.SELLER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ver mis productos (vendedor)' })
  @ApiOkResponseData()
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListProductsQueryDto) {
    return this.productsService.findMine(user.sub, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Ver el detalle de un producto' })
  @ApiOkResponseData()
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  @Roles(UserRole.SELLER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Publicar un producto (vendedor verificado)' })
  @ApiCreatedResponseData(CreateProductDto)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.sub, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar un producto' })
  @ApiOkResponseData(UpdateProductDto)
  update(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, { userId: user.sub, role: user.role as UserRole }, dto);
  }

  @Patch(':id/stock')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar existencias de un producto' })
  @ApiOkResponseData(UpdateStockDto)
  updateStock(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateStockDto,
  ) {
    return this.productsService.updateStock(id, { userId: user.sub, role: user.role as UserRole }, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar un producto' })
  @ApiOkResponseData()
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.productsService.remove(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Post(':id/images')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Agregar imágenes a un producto' })
  @ApiCreatedResponseData()
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
      fileFilter: imageFileFilter,
    }),
  )
  addImages(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.addImages(id, { userId: user.sub, role: user.role as UserRole }, files);
  }

  @Delete(':id/images/:imageId')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar una imagen de un producto' })
  @ApiOkResponseData()
  removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.removeImage(id, imageId, {
      userId: user.sub,
      role: user.role as UserRole,
    });
  }
}
