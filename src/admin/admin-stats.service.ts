import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  ProductStatus,
  ReportStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../database';
import { TransactionsService } from '../finance';

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getDashboard() {
    const [
      usersByRole,
      activeUsers,
      inactiveUsers,
      sellersByStatus,
      productsByStatus,
      ordersByStatus,
      deliveredRevenueAgg,
      totalProductReviews,
      totalSellerReviews,
      reportsByStatus,
      finance,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.sellerProfile.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
      this.prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED },
        _sum: { totalAmount: true },
      }),
      // Las reseñas se publican solas (ver reviews.service.ts) — ya no hay
      // cola de pendientes, así que el dashboard reporta el volumen total.
      this.prisma.productReview.count(),
      this.prisma.sellerReview.count(),
      this.prisma.report.groupBy({ by: ['status'], _count: { _all: true } }),
      this.transactionsService.getAdminDashboard(),
    ]);

    const byRole = Object.fromEntries(Object.values(UserRole).map((r) => [r, 0])) as Record<
      UserRole,
      number
    >;
    usersByRole.forEach((u) => {
      byRole[u.role] = u._count._all;
    });

    const byVerificationStatus = Object.fromEntries(
      Object.values(VerificationStatus).map((s) => [s, 0]),
    ) as Record<VerificationStatus, number>;
    sellersByStatus.forEach((s) => {
      byVerificationStatus[s.verificationStatus] = s._count._all;
    });

    const byProductStatus = Object.fromEntries(
      Object.values(ProductStatus).map((s) => [s, 0]),
    ) as Record<ProductStatus, number>;
    productsByStatus.forEach((p) => {
      byProductStatus[p.status] = p._count._all;
    });

    const byOrderStatus = Object.fromEntries(Object.values(OrderStatus).map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >;
    ordersByStatus.forEach((o) => {
      byOrderStatus[o.status] = o._count._all;
    });

    const byReportStatus = Object.fromEntries(Object.values(ReportStatus).map((s) => [s, 0])) as Record<
      ReportStatus,
      number
    >;
    reportsByStatus.forEach((r) => {
      byReportStatus[r.status] = r._count._all;
    });

    return {
      users: {
        total: Object.values(byRole).reduce((sum, n) => sum + n, 0),
        byRole,
        active: activeUsers,
        inactive: inactiveUsers,
      },
      sellers: {
        total: Object.values(byVerificationStatus).reduce((sum, n) => sum + n, 0),
        byVerificationStatus,
      },
      products: {
        total: Object.values(byProductStatus).reduce((sum, n) => sum + n, 0),
        byStatus: byProductStatus,
      },
      orders: {
        total: Object.values(byOrderStatus).reduce((sum, n) => sum + n, 0),
        byStatus: byOrderStatus,
        totalDeliveredRevenue: Number(deliveredRevenueAgg._sum.totalAmount ?? 0),
      },
      reviews: {
        totalProductReviews,
        totalSellerReviews,
      },
      reports: {
        total: Object.values(byReportStatus).reduce((sum, n) => sum + n, 0),
        byStatus: byReportStatus,
      },
      finance,
    };
  }
}
