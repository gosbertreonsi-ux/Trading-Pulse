-- One-shot thresholds are never orders and never move money.
CREATE TABLE "PriceAlert" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "targetPrice" DECIMAL(18,4) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "observedPrice" DECIMAL(18,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "triggeredAt" TIMESTAMP(3),
  CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PriceAlert_direction_check" CHECK ("direction" IN ('ABOVE','BELOW')),
  CONSTRAINT "PriceAlert_status_check" CHECK ("status" IN ('ACTIVE','TRIGGERED'))
);

CREATE INDEX "PriceAlert_clientId_status_symbol_idx"
ON "PriceAlert"("clientId", "status", "symbol");

CREATE INDEX "PriceAlert_clientId_createdAt_idx"
ON "PriceAlert"("clientId", "createdAt");
