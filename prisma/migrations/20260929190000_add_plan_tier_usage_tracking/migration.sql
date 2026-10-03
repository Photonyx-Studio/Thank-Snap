-- Cached usage against the shop's plan order cap (see PLAN_TIERS in
-- billing.server.ts). Nullable/zero-defaulted so existing rows don't need
-- backfilling - the first read of getUsageStatus() for a shop treats a null
-- usagePeriodStart as "cache is stale" and computes it fresh.
ALTER TABLE "Shop" ADD COLUMN "usagePeriodStart" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN "usagePeriodOrderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN "usageCheckedAt" TIMESTAMP(3);
