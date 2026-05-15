-- Optional payment proof for manual verification (URL or uploaded file path).

ALTER TABLE "Transaction" ADD COLUMN "paymentProofUrl" TEXT;
