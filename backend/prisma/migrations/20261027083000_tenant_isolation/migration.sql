-- Align the original database migration with the current multi-tenant Prisma
-- schema. Preserve legacy rows under the explicit "global" tenant instead of
-- silently attributing old trades to a newly created simulator tenant.
ALTER TABLE "Trade"
ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'global';

ALTER TABLE "OHLCV"
ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'global';

-- A candle timestamp/symbol may occur once per tenant, not just once globally.
DROP INDEX IF EXISTS "OHLCV_symbol_timestamp_key";
DROP INDEX IF EXISTS "Trade_symbol_timestamp_idx";

CREATE INDEX "Trade_clientId_symbol_timestamp_idx"
ON "Trade"("clientId", "symbol", "timestamp");

CREATE UNIQUE INDEX "OHLCV_clientId_symbol_timestamp_key"
ON "OHLCV"("clientId", "symbol", "timestamp");
