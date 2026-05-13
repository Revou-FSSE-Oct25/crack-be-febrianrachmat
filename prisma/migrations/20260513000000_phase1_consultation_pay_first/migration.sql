-- Phase 1: pay-first consultation flow.
--
-- This migration evolves Consultation and Transaction so a Consultation acts
-- as a paid, online chat session:
--   1. Map deprecated ConsultationStatus.REJECTED to CANCELLED.
--   2. Add IN_PROGRESS to ConsultationStatus.
--   3. Add Consultation.feeSnapshot (backfilled from the therapist's current
--      consultationFee), plus acceptedAt / startedAt / completedAt timestamps.
--   4. Make Transaction.bookingId nullable and add Transaction.consultationId
--      so a transaction can be tied to either a Booking or a Consultation.

BEGIN;

-- Step 1: backfill existing rows BEFORE altering the enum.
UPDATE "Consultation"
SET "status" = 'CANCELLED'
WHERE "status" = 'REJECTED';

-- Step 2: rebuild the enum (PostgreSQL needs a USING clause for value rename).
ALTER TYPE "ConsultationStatus" RENAME TO "ConsultationStatus_old";

CREATE TYPE "ConsultationStatus" AS ENUM (
  'REQUESTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "Consultation"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ConsultationStatus"
    USING ("status"::text::"ConsultationStatus"),
  ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

DROP TYPE "ConsultationStatus_old";

-- Step 3: add new Consultation columns (nullable first, then backfill, then enforce NOT NULL).
ALTER TABLE "Consultation"
  ADD COLUMN "feeSnapshot" DECIMAL(12,2),
  ADD COLUMN "acceptedAt"  TIMESTAMP(3),
  ADD COLUMN "startedAt"   TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Consultation" c
SET "feeSnapshot" = pp."consultationFee"
FROM "PhysiotherapistProfile" pp
WHERE c."physiotherapistId" = pp."id"
  AND c."feeSnapshot" IS NULL;

-- Fallback for any orphan row (should not happen, but keep migration safe).
UPDATE "Consultation"
SET "feeSnapshot" = 0
WHERE "feeSnapshot" IS NULL;

ALTER TABLE "Consultation"
  ALTER COLUMN "feeSnapshot" SET NOT NULL;

-- Step 4: relax Transaction.bookingId and add consultationId.
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_bookingId_fkey";

ALTER TABLE "Transaction"
  ALTER COLUMN "bookingId" DROP NOT NULL,
  ADD COLUMN "consultationId" TEXT;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_consultationId_fkey"
  FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Transaction_consultationId_status_idx"
  ON "Transaction"("consultationId", "status");

COMMIT;
