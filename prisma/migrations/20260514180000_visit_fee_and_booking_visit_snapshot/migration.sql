-- Separate visit (in-person) pricing from online consultation fee.
-- Lock visit price on each Booking at creation time (mirrors Consultation.feeSnapshot).

ALTER TABLE "PhysiotherapistProfile" ADD COLUMN "visitFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "PhysiotherapistProfile" SET "visitFee" = "consultationFee";

ALTER TABLE "Booking" ADD COLUMN "visitFeeSnapshot" DECIMAL(12,2);

UPDATE "Booking" AS b
SET "visitFeeSnapshot" = p."visitFee"
FROM "PhysiotherapistProfile" AS p
WHERE b."physiotherapistId" = p."id" AND b."visitFeeSnapshot" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "visitFeeSnapshot" SET NOT NULL;
