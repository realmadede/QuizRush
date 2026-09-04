-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "pendingEmail" TEXT;
