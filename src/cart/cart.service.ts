import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CartStatus, ProductStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../database';
import { AddCartItemDto, UpdateCartItemDto } from './dto';

const CART_ITEM_PRODUCT_SELECT = {
  id: true,
  name: true,
  price: true,
  unit: true,
  stock: true,
  status: true,
  images: { select: { url: true }, orderBy: { order: 'asc' as const }, take: 1 },
} as const;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateActiveCart(userId: string) {
    const existing = await this.prisma.cart.findFirst({
      where: { userId, status: CartStatus.ACTIVE },
    });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId, status: CartStatus.ACTIVE } });
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateActiveCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
      include: { product: { select: CART_ITEM_PRODUCT_SELECT } },
    });

    const itemsWithSubtotal = items.map((item) => ({
      ...item,
      subtotal: Number((Number(item.product.price) * item.quantity).toFixed(2)),
    }));
    const total = Number(itemsWithSubtotal.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));

    return { ...cart, items: itemsWithSubtotal, total };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.assertProductPurchasable(dto.productId, dto.quantity);
    const cart = await this.getOrCreateActiveCart(userId);

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
    });

    if (existing) {
      const newQuantity = existing.quantity + dto.quantity;
      if (newQuantity > product.stock) {
        throw new BadRequestException(
          `No hay suficiente stock de "${product.name}" (disponible: ${product.stock})`,
        );
      }
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
      });
    }

    return this.prisma.cartItem.create({
      data: { cartId: cart.id, productId: dto.productId, quantity: dto.quantity },
    });
  }

  async updateItemQuantity(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.getOwnedItem(userId, itemId);
    await this.assertProductPurchasable(item.productId, dto.quantity);

    return this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
  }

  async removeItem(userId: string, itemId: string) {
    await this.getOwnedItem(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { message: 'Producto eliminado del carrito' };
  }

  // --------------------------------------------------------------------
  // HELPERS PRIVADOS
  // --------------------------------------------------------------------

  private async assertProductPurchasable(productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException(`El producto "${product.name}" no está disponible`);
    }
    // A propósito NO exige seller.verificationStatus === VERIFIED — modelo
    // estilo eBay, ver el comentario en products.service.ts#findMany. Un
    // vendedor sin verificar (PENDING/UNDER_REVIEW/REJECTED) sí puede
    // vender; el comprador ve el sello (o la falta de él) y decide. Pero
    // SUSPENDED es una acción activa del admin (fraude, incumplimiento) —
    // suspender no desactiva sus productos (ver `suspendSeller` en
    // users.service.ts), así que hay que frenar la compra acá.
    if (product.seller.verificationStatus === VerificationStatus.SUSPENDED) {
      throw new BadRequestException(`El producto "${product.name}" no está disponible actualmente`);
    }
    if (quantity > product.stock) {
      throw new BadRequestException(
        `No hay suficiente stock de "${product.name}" (disponible: ${product.stock})`,
      );
    }
    return product;
  }

  private async getOwnedItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!item) throw new NotFoundException('Producto de carrito no encontrado');
    if (item.cart.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar este carrito');
    }
    return item;
  }
}
