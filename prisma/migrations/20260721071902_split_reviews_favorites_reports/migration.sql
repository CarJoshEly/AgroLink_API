-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'PRODUCT_REVIEW';
ALTER TYPE "ReportTargetType" ADD VALUE 'SELLER_REVIEW';

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_reviews" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "responseTimeScore" INTEGER NOT NULL,
    "complianceScore" INTEGER NOT NULL,
    "attentionScore" INTEGER NOT NULL,
    "trustScore" INTEGER NOT NULL,
    "comment" TEXT,
    "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "seller_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_orderItemId_key" ON "product_reviews"("orderItemId");

-- CreateIndex
CREATE INDEX "product_reviews_productId_idx" ON "product_reviews"("productId");

-- CreateIndex
CREATE INDEX "product_reviews_buyerId_idx" ON "product_reviews"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_reviews_orderId_key" ON "seller_reviews"("orderId");

-- CreateIndex
CREATE INDEX "seller_reviews_sellerId_idx" ON "seller_reviews"("sellerId");

-- CreateIndex
CREATE INDEX "seller_reviews_buyerId_idx" ON "seller_reviews"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_productId_key" ON "favorites"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_sellerId_key" ON "favorites"("userId", "sellerId");

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_reviews" ADD CONSTRAINT "seller_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_reviews" ADD CONSTRAINT "seller_reviews_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_reviews" ADD CONSTRAINT "seller_reviews_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration
-- Cada fila de la antigua tabla "reviews" mapea 1:1 a exactamente una
-- seller_reviews (mismos 5 puntajes) y una product_reviews (usa qualityScore
-- como el rating 1-5 del producto, la dimensión más relacionada al producto
-- entre las cinco). Se reutiliza el mismo id en ambas tablas nuevas.
INSERT INTO "seller_reviews" ("id", "orderId", "sellerId", "buyerId", "qualityScore", "responseTimeScore", "complianceScore", "attentionScore", "trustScore", "comment", "moderationStatus", "createdAt", "updatedAt")
SELECT "id", "orderId", "sellerId", "buyerId", "qualityScore", "responseTimeScore", "complianceScore", "attentionScore", "trustScore", "comment", "moderationStatus", "createdAt", "createdAt"
FROM "reviews";

INSERT INTO "product_reviews" ("id", "orderId", "orderItemId", "productId", "buyerId", "rating", "comment", "moderationStatus", "createdAt", "updatedAt")
SELECT DISTINCT ON (r."id") r."id", r."orderId", oi."id", r."productId", r."buyerId", r."qualityScore", r."comment", r."moderationStatus", r."createdAt", r."createdAt"
FROM "reviews" r
JOIN "order_items" oi ON oi."orderId" = r."orderId" AND oi."productId" = r."productId"
ORDER BY r."id", oi."id";

-- DropTable
DROP TABLE "reviews";
