-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3);
