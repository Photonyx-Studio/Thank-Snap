import type { JwtPayload } from "@shopify/shopify-api";
import db from "../db.server";

/** Checkout session tokens carry the shop's admin domain with a protocol prefix. */
export function shopDomainFromSessionToken(sessionToken: JwtPayload): string {
  return sessionToken.dest.replace(/^https?:\/\//, "");
}

/**
 * Looks up the Shop row for a checkout session token. Deliberately read-only
 * (`findUnique`, not `upsert`) — these are public, buyer-facing routes, so a
 * shop that's never opened the admin app shouldn't get a row created for it
 * here.
 */
export async function findShopBySessionToken(sessionToken: JwtPayload) {
  const shopDomain = shopDomainFromSessionToken(sessionToken);
  return db.shop.findUnique({ where: { shopDomain } });
}
