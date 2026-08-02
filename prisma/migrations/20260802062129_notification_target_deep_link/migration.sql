-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('ORDER', 'PRODUCT', 'SELLER');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetType" "NotificationTargetType";
