-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'TRANSACTION_MARK_PAID',
  'TRANSACTION_REFUND',
  'TRANSACTION_SLA_AUTO_REFUND',
  'REVIEW_MODERATE',
  'PHYSIOTHERAPIST_VERIFY',
  'NOTIFICATION_BROADCAST',
  'NOTIFICATION_SEND_USER'
);

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM (
  'TRANSACTION',
  'BOOKING',
  'CONSULTATION',
  'REVIEW',
  'PHYSIOTHERAPIST',
  'USER'
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
