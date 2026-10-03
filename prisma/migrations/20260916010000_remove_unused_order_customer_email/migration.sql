-- Order.customerEmail was never written to anywhere in the app (dead column
-- from an earlier design) - all 3 live rows have it null. Dropped rather
-- than left in place: an unused column shaped like customer PII invites a
-- future mistake (populating it without going through Shopify's Protected
-- Customer Data review).

ALTER TABLE "Order" DROP COLUMN "customerEmail";
