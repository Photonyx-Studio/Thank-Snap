/**
 * Resolves the app's public URL for OAuth/auth redirects. Prefers an
 * explicit SHOPIFY_APP_URL (set locally by `shopify app dev`, or manually in
 * production), and falls back to Vercel's own env var for the production
 * deployment URL so this doesn't silently break if SHOPIFY_APP_URL is ever
 * left unset there.
 */
export function getAppUrl(): string {
  const explicit = process.env.SHOPIFY_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}
