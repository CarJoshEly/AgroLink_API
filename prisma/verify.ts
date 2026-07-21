// ==========================================================================
// Reporte de integridad post-seed: conteo por tabla + verificaciones de
// huérfanos (referencias sin padre). Las FK reales de Postgres ya impiden
// huérfanos verdaderos; esto es evidencia documentada para el entregable.
// ==========================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const counters: [string, () => Promise<number>][] = [
    ['departments', () => prisma.department.count()],
    ['municipalities', () => prisma.municipality.count()],
    ['users', () => prisma.user.count()],
    ['locations', () => prisma.location.count()],
    ['seller_profiles', () => prisma.sellerProfile.count()],
    ['identity_verifications', () => prisma.identityVerification.count()],
    ['categories', () => prisma.category.count()],
    ['products', () => prisma.product.count()],
    ['product_images', () => prisma.productImage.count()],
    ['carts', () => prisma.cart.count()],
    ['cart_items', () => prisma.cartItem.count()],
    ['favorites', () => prisma.favorite.count()],
    ['orders', () => prisma.order.count()],
    ['order_items', () => prisma.orderItem.count()],
    ['product_reviews', () => prisma.productReview.count()],
    ['seller_reviews', () => prisma.sellerReview.count()],
    ['reports', () => prisma.report.count()],
    ['notifications', () => prisma.notification.count()],
    ['payment_methods', () => prisma.paymentMethod.count()],
    ['transactions', () => prisma.transaction.count()],
    ['commission_configs', () => prisma.commissionConfig.count()],
    ['audit_logs', () => prisma.auditLog.count()],
  ];

  console.log('\u{1F4CA} Conteo de filas por tabla:\n');
  let total = 0;
  for (const [label, run] of counters) {
    const count = await run();
    console.log(`  ${label.padEnd(24)} ${String(count).padStart(8)}`);
    total += count;
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${String(total).padStart(8)}`);

  console.log('\n\u{1F50D} Verificación de integridad referencial (huérfanos):\n');

  // Se usa SQL crudo con LEFT JOIN porque el filtro de relaciones de Prisma
  // no acepta `null` para relaciones requeridas (aunque a nivel de Postgres
  // las FK ya lo impiden; esto documenta la evidencia para el entregable).
  const orphanChecks: [string, () => Promise<{ count: bigint }[]>][] = [
    ['orders.buyerId sin User', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM orders o LEFT JOIN users u ON u.id = o."buyerId" WHERE u.id IS NULL`],
    ['orders.sellerId sin SellerProfile', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM orders o LEFT JOIN seller_profiles s ON s.id = o."sellerId" WHERE s.id IS NULL`],
    ['order_items.productId sin Product', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM order_items oi LEFT JOIN products p ON p.id = oi."productId" WHERE p.id IS NULL`],
    ['order_items.orderId sin Order', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM order_items oi LEFT JOIN orders o ON o.id = oi."orderId" WHERE o.id IS NULL`],
    ['products.sellerId sin SellerProfile', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM products p LEFT JOIN seller_profiles s ON s.id = p."sellerId" WHERE s.id IS NULL`],
    ['products.categoryId sin Category', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM products p LEFT JOIN categories c ON c.id = p."categoryId" WHERE c.id IS NULL`],
    ['product_reviews.orderItemId sin OrderItem', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM product_reviews r LEFT JOIN order_items oi ON oi.id = r."orderItemId" WHERE oi.id IS NULL`],
    ['seller_reviews.orderId sin Order', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM seller_reviews r LEFT JOIN orders o ON o.id = r."orderId" WHERE o.id IS NULL`],
    ['favorites.productId huérfano (cuando aplica)', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM favorites f LEFT JOIN products p ON p.id = f."productId" WHERE f."productId" IS NOT NULL AND p.id IS NULL`],
    ['favorites.sellerId huérfano (cuando aplica)', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM favorites f LEFT JOIN seller_profiles s ON s.id = f."sellerId" WHERE f."sellerId" IS NOT NULL AND s.id IS NULL`],
    ['seller_profiles.userId sin User', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM seller_profiles s LEFT JOIN users u ON u.id = s."userId" WHERE u.id IS NULL`],
    ['locations sin Department/Municipality', () => prisma.$queryRaw`SELECT COUNT(*) as count FROM locations l LEFT JOIN departments d ON d.id = l."departmentId" LEFT JOIN municipalities m ON m.id = l."municipalityId" WHERE d.id IS NULL OR m.id IS NULL`],
  ];

  let orphansFound = 0;
  for (const [label, run] of orphanChecks) {
    const rows = await run();
    const count = Number(rows[0]?.count ?? 0);
    orphansFound += count;
    console.log(`  ${count === 0 ? '✓' : '✗'} ${label.padEnd(45)} ${count}`);
  }

  console.log(
    orphansFound === 0
      ? '\n✅ Sin huérfanos detectados — integridad referencial confirmada.'
      : `\n⚠️  Se detectaron ${orphansFound} registros huérfanos.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
