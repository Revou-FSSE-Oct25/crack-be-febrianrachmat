-- Phase 2: lightweight "online now" presence for approved therapists.
-- `onlineUntil` is bumped by heartbeat; browse filter uses onlineUntil > now().

ALTER TABLE "PhysiotherapistProfile"
  ADD COLUMN "onlineUntil" TIMESTAMP(3);

CREATE INDEX "PhysiotherapistProfile_verificationStatus_onlineUntil_idx"
  ON "PhysiotherapistProfile"("verificationStatus", "onlineUntil");
