-- Cancellation / scheduled plan change from the Partner API's
-- activeSubscription (see subscription.server.ts), the shop's GID for the
-- App Events API, and per-order overage billing state (see
-- usage-billing.server.ts). All nullable/defaulted, so existing rows don't
-- need backfilling - they're filled on the next subscription refresh.
ALTER TABLE "Shop" ADD COLUMN "subscriptionCancelAtEndOfCycle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN "subscriptionPendingPlanHandle" TEXT;
ALTER TABLE "Shop" ADD COLUMN "shopGid" TEXT;
ALTER TABLE "Order" ADD COLUMN "overageBilledAt" TIMESTAMP(3);
