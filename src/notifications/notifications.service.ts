import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationTargetType, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../database';
import { ListNotificationsQueryDto } from './dto';

/** A qué navegar al tocar la notificación — omitirlo es válido (no todas lo tienen). */
export type NotificationTarget = { targetType: NotificationTargetType; targetId: string };

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    target?: NotificationTarget,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, title, message, targetType: target?.targetType, targetId: target?.targetId },
    });
  }

  createMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    target?: NotificationTarget,
  ) {
    if (userIds.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        targetType: target?.targetType,
        targetId: target?.targetId,
      })),
    });
  }

  async findMine(userId: string, query: ListNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  getUnreadCount(userId: string) {
    return this.prisma.notification
      .count({ where: { userId, isRead: false } })
      .then((count) => ({ count }));
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.getOwned(id, userId);
    return this.prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async remove(id: string, userId: string) {
    const notification = await this.getOwned(id, userId);
    await this.prisma.notification.delete({ where: { id: notification.id } });
    return { message: 'Notificación eliminada' };
  }

  private async getOwned(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notificación no encontrada');
    if (notification.userId !== userId) {
      throw new ForbiddenException('No tienes permiso sobre esta notificación');
    }
    return notification;
  }
}
