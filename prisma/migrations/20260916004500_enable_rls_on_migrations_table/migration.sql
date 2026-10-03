-- _prisma_migrations isn't a Prisma-modeled table (it's Prisma's own
-- migration bookkeeping, holding only migration names/checksums/timestamps -
-- no merchant or customer data), so it was missed by the app's tables when
-- RLS was first enabled (see 20260827230122_enable_row_level_security).
-- Supabase's security advisor flags any public-schema table without RLS
-- regardless of what it contains, so this closes that out too. Same
-- default-deny pattern as every other table: no policies, so the
-- PostgREST anon/authenticated roles get zero rows; Prisma is unaffected
-- since it connects as the table owner.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
