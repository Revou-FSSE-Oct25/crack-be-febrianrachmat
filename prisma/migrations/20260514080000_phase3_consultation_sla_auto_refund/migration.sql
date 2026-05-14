-- Phase 3: consultation first-reply SLA + automatic refund via cron.

CREATE TYPE "ConsultationSlaTier" AS ENUM ('STANDARD', 'FAST_ONLINE');

ALTER TABLE "Consultation"
  ADD COLUMN "slaTier" "ConsultationSlaTier" NOT NULL DEFAULT 'STANDARD';

CREATE INDEX "Consultation_status_startedAt_idx"
  ON "Consultation"("status", "startedAt");
