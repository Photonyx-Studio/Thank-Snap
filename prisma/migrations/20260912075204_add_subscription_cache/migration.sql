-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "subscriptionActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionCheckedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "subscriptionPlanHandle" TEXT,
ADD COLUMN     "subscriptionTrialEndsAt" TIMESTAMP(3);
