// ==========================================================================
// Fix puntual: diversifica seller_reviews y product_reviews existentes.
//
// El seed original generaba un único {comment, moderationStatus, createdAt}
// por pedido y lo reutilizaba tal cual en ambas tablas. Este script recorre
// las filas ya existentes y les asigna valores independientes y coherentes
// con su propio puntaje (rating / promedio de scores del vendedor), sin
// tocar ninguna otra tabla ni los puntajes numéricos ya guardados.
// ==========================================================================

import { PrismaClient, ReviewModerationStatus } from '@prisma/client';

const prisma = new PrismaClient();

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400 * 1000);
}

function weightedPickPool<T>(items: { value: T; weight: number }[]): () => T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  return () => {
    let r = Math.random() * total;
    for (const it of items) {
      if (r < it.weight) return it.value;
      r -= it.weight;
    }
    return items[items.length - 1].value;
  };
}

const SELLER_POSITIVE_COMMENTS = [
  'El vendedor fue muy puntual y respondió rápido a mis mensajes.',
  'Buena atención y precio justo, volveré a comprarle a este vendedor.',
  'Todo perfecto, gracias por la atención y el seguimiento del pedido.',
  'Vendedor muy confiable, cumplió con los tiempos acordados.',
  'Excelente comunicación durante todo el proceso de compra.',
  'Muy buena experiencia con este vendedor, lo recomiendo.',
];
const SELLER_NEUTRAL_COMMENTS = [
  'El vendedor cumplió, aunque la respuesta a mensajes tardó un poco.',
  'Atención correcta, la comunicación pudo ser más fluida.',
  'Cumple con lo ofrecido, sin más comentarios sobre el vendedor.',
];
const SELLER_NEGATIVE_COMMENTS = [
  'El vendedor tardó demasiado en responder y coordinar la entrega.',
  'Hubo demora considerable de parte del vendedor.',
  'Poca comunicación por parte del vendedor durante el pedido.',
];

const PRODUCT_POSITIVE_COMMENTS = [
  'Excelente calidad, tal como se describe. Muy recomendado.',
  'El producto llegó fresco y bien empacado.',
  'Producto de primera, superó mis expectativas.',
  'Muy buena calidad, se nota que es producto fresco del campo.',
  'Justo lo que esperaba, producto en perfecto estado.',
  'Muy buena experiencia de compra, producto fresco y bien empacado.',
];
const PRODUCT_NEUTRAL_COMMENTS = [
  'El producto cumplió, aunque la entrega tardó un poco más de lo esperado.',
  'Buen producto, aunque esperaba un poco más de frescura.',
  'Cumple con lo ofrecido, sin más comentarios sobre el producto.',
];
const PRODUCT_NEGATIVE_COMMENTS = [
  'El producto llegó en peores condiciones de lo esperado.',
  'La calidad no era la que se mostraba en la publicación.',
  'La cantidad no coincidía exactamente con lo solicitado.',
];

function reviewComment(
  avgScore: number,
  pools: { positive: string[]; neutral: string[]; negative: string[] },
): string | null {
  if (Math.random() < 0.15) return null;
  if (avgScore >= 4) return pick(pools.positive);
  if (avgScore >= 3) return pick(pools.neutral);
  return pick(pools.negative);
}

const moderationPool = weightedPickPool<ReviewModerationStatus>([
  { value: ReviewModerationStatus.APPROVED, weight: 85 },
  { value: ReviewModerationStatus.PENDING_REVIEW, weight: 10 },
  { value: ReviewModerationStatus.REJECTED, weight: 5 },
]);

const CHUNK_SIZE = 8;

async function chunkedRun<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(fn));
    process.stdout.write(`\r  ${Math.min(i + CHUNK_SIZE, items.length)}/${items.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  const now = new Date();

  console.log('📥 Cargando seller_reviews y sus pedidos...');
  const sellerReviews = await prisma.sellerReview.findMany({
    include: { order: { select: { deliveredAt: true, createdAt: true } } },
  });

  console.log('📥 Cargando product_reviews y sus pedidos...');
  const productReviews = await prisma.productReview.findMany({
    include: { order: { select: { deliveredAt: true, createdAt: true } } },
  });

  console.log(`\n⭐ Actualizando ${sellerReviews.length} seller_reviews...`);
  await chunkedRun(sellerReviews, async (review) => {
    const avg =
      (review.qualityScore +
        review.responseTimeScore +
        review.complianceScore +
        review.attentionScore +
        review.trustScore) /
      5;
    const base = review.order.deliveredAt ?? review.order.createdAt;
    const createdAt = addDays(base, randInt(0, 10));
    const clampedCreatedAt = createdAt.getTime() > now.getTime() ? now : createdAt;

    await prisma.sellerReview.update({
      where: { id: review.id },
      data: {
        comment: reviewComment(avg, {
          positive: SELLER_POSITIVE_COMMENTS,
          neutral: SELLER_NEUTRAL_COMMENTS,
          negative: SELLER_NEGATIVE_COMMENTS,
        }),
        moderationStatus: moderationPool(),
        createdAt: clampedCreatedAt,
      },
    });
  });

  console.log(`\n⭐ Actualizando ${productReviews.length} product_reviews...`);
  await chunkedRun(productReviews, async (review) => {
    const base = review.order.deliveredAt ?? review.order.createdAt;
    const createdAt = addDays(base, randInt(0, 10));
    const clampedCreatedAt = createdAt.getTime() > now.getTime() ? now : createdAt;

    await prisma.productReview.update({
      where: { id: review.id },
      data: {
        comment: reviewComment(review.rating, {
          positive: PRODUCT_POSITIVE_COMMENTS,
          neutral: PRODUCT_NEUTRAL_COMMENTS,
          negative: PRODUCT_NEGATIVE_COMMENTS,
        }),
        moderationStatus: moderationPool(),
        createdAt: clampedCreatedAt,
      },
    });
  });

  console.log('\n✅ Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
