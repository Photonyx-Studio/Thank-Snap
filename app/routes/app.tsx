import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import * as Sentry from "@sentry/react-router";

import { authenticate } from "../shopify.server";
import { requireActiveSubscription } from "../subscription.server";
import { useEagerPreload } from "../utils/usePrefetchOnHover";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);

  const subscriptionRedirect = await requireActiveSubscription({
    admin,
    session,
    redirect,
  });
  if (subscriptionRedirect) return subscriptionRedirect;

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

// apiKey never changes and every child route already authenticates itself,
// so there's no need to re-run this loader (and its session lookup) on
// every in-app navigation between Home / Survey / Responses.
export const shouldRevalidate = () => false;

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  // Also flips Shopify's native top-of-admin progress bar, for consistency
  // with the rest of the admin while the loading screen below is showing.
  useEffect(() => {
    window.shopify?.loading(isNavigating);
  }, [isNavigating]);

  // Fires each persistent nav tab's loader as soon as the app shell mounts,
  // so whichever one the merchant clicks next is already loaded or in
  // flight - the session-token exchange and DB query for each still has to
  // happen (can't be skipped), this just starts them immediately instead of
  // on click. Each needs its own hook call: one fetcher can only track one
  // in-flight request, so separate fetchers are what makes these run in
  // parallel instead of queued behind each other.
  useEagerPreload("/app");
  useEagerPreload("/app/survey");
  useEagerPreload("/app/responses");
  useEagerPreload("/app/billing");

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/dashboard">Dashboard</s-link>
        <s-link href="/app/survey">Survey</s-link>
        <s-link href="/app/responses">Responses</s-link>
        <s-link href="/app/billing">Billing</s-link>
        <s-link href="/app/feedback">Contact us</s-link>
      </s-app-nav>
      {isNavigating ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            minHeight: "60vh",
          }}
        >
          <s-spinner accessibilityLabel="Loading" size="large" />
        </div>
      ) : (
        <Outlet />
      )}
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
// Also reports to Sentry: this boundary catches client-side rendering
// errors too, not just the loader/action throws entry.server.tsx's
// handleError already reports on the server.
export function ErrorBoundary() {
  const error = useRouteError();
  Sentry.captureException(error);
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
