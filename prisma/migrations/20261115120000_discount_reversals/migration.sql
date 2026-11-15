ALTER TABLE "Discount" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "Discount" ADD COLUMN "reversedBy" TEXT;
ALTER TABLE "Discount" ADD COLUMN "reversalReason" TEXT;
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_reversal_details" CHECK (
  ("reversedAt" IS NULL AND "reversedBy" IS NULL AND "reversalReason" IS NULL)
  OR ("reversedAt" IS NOT NULL AND "reversedBy" IS NOT NULL AND "reversalReason" IS NOT NULL)
);
