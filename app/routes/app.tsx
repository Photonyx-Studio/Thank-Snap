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

import { authenticate } from "../shopify.server";
import { STARTER_PLAN } from "../billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  // TODO: flip isTest to false once ready to charge real merchants for real.
  await billing.require({
    plans: [STARTER_PLAN],
    isTest: true,
    onFailure: async () => billing.request({ plan: STARTER_PLAN }),
  });

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

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/survey">Survey</s-link>
        <s-link href="/app/responses">Responses</s-link>
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
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
