import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import prisma from "./db.server";
import { getAppUrl } from "./utils/app-url";
import { EncryptedPrismaSessionStorage } from "./encrypted-session-storage.server";

// Billing is handled by Shopify App Pricing (see subscription.server.ts),
// which is configured in the Partner Dashboard rather than here - this app
// no longer calls the Billing API, so there's no `billing` config to pass.
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: getAppUrl(),
  authPathPrefix: "/auth",
  // Encrypts accessToken/refreshToken at rest (AES-256-GCM) before they
  // reach Supabase - see encrypted-session-storage.server.ts.
  sessionStorage: new EncryptedPrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    // Runs when a new session is created - on install/reinstall among
    // others. Expires the cached subscription so the next request
    // re-checks the Partner API and, after a reinstall, sends the merchant
    // back through plan approval. A backstop for the app/uninstalled
    // webhook (which clears it too), since webhook delivery can lag.
    afterAuth: async ({ session }) => {
      await prisma.shop.updateMany({
        where: { shopDomain: session.shop },
        data: { subscriptionCheckedAt: null },
      });
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
