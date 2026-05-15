-- Enforce XOR: each transaction links to exactly one of booking or consultation.
ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_booking_xor_consultation"
CHECK (
  ("bookingId" IS NOT NULL AND "consultationId" IS NULL)
  OR ("bookingId" IS NULL AND "consultationId" IS NOT NULL)
);

-- At most one active (PENDING or PAID) transaction per booking.
CREATE UNIQUE INDEX "Transaction_one_active_per_booking"
ON "Transaction" ("bookingId")
WHERE "bookingId" IS NOT NULL AND "status" IN ('PENDING', 'PAID');

-- At most one active (PENDING or PAID) transaction per consultation.
CREATE UNIQUE INDEX "Transaction_one_active_per_consultation"
ON "Transaction" ("consultationId")
WHERE "consultationId" IS NOT NULL AND "status" IN ('PENDING', 'PAID');
