-- Supabase auto-exposes every table in the `public` schema over a REST API
-- (PostgREST), gated only by an API key -- not by our app's own auth. Without
-- Row Level Security, that REST API allows full read/write access to anyone
-- holding the project's anon key, completely bypassing authenticate.admin /
-- authenticate.public.checkout.
--
-- Enabling RLS with no policies defined is a default-deny: it blocks the
-- anon/authenticated PostgREST roles from touching these tables at all. It
-- has zero effect on this app's own access, since Prisma connects as the
-- `postgres` role (the table owner), and table owners bypass RLS unless
-- FORCE ROW LEVEL SECURITY is also set, which is deliberately not used here.

ALTER TABLE "Shop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Survey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Response" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
