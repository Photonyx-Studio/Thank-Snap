-- The checkout session token's `sid` that first reported this order (see
-- api.survey-view.tsx) - lets overage billing tell a legitimate reload of
-- the same order apart from one captured token being replayed with
-- fabricated order ids, without needing read_orders/Protected Customer Data
-- approval. Nullable, so existing rows don't need backfilling.
ALTER TABLE "Order" ADD COLUMN "reporterSid" TEXT;
CREATE INDEX "Order_shopId_reporterSid_idx" ON "Order"("shopId", "reporterSid");
