-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'OTHER');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "message" TEXT NOT NULL,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_shopId_idx" ON "Feedback"("shopId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match this app's Supabase RLS convention (see 20260827230122_enable_row_level_security):
-- default-deny for the PostgREST anon/authenticated roles. Prisma connects as
-- the table owner and is unaffected.
ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
