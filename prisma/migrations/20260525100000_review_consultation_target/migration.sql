-- Review may target a completed booking OR a completed consultation (XOR).
ALTER TABLE "Review" ALTER COLUMN "bookingId" DROP NOT NULL;

ALTER TABLE "Review" ADD COLUMN "consultationId" TEXT;

CREATE UNIQUE INDEX "Review_consultationId_patientId_key"
ON "Review"("consultationId", "patientId");

ALTER TABLE "Review"
ADD CONSTRAINT "Review_consultationId_fkey"
FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
ADD CONSTRAINT "Review_booking_xor_consultation"
CHECK (
  ("bookingId" IS NOT NULL AND "consultationId" IS NULL)
  OR ("bookingId" IS NULL AND "consultationId" IS NOT NULL)
);
