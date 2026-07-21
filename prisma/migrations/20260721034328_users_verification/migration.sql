-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_SUSPENDED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT;
