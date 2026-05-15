-- DropForeignKey
ALTER TABLE "EmailVerificationToken" DROP CONSTRAINT IF EXISTS "EmailVerificationToken_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "EmailVerificationToken";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerifiedAt";
