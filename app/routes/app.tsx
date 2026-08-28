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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

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

  // Shows Shopify's native top-of-admin progress bar while a Home / Survey /
  // Responses navigation is loading, so the app doesn't look frozen while
  // its loader data fetches.
  useEffect(() => {
    window.shopify?.loading(navigation.state !== "idle");
  }, [navigation.state]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/survey">Survey</s-link>
        <s-link href="/app/responses">Responses</s-link>
      </s-app-nav>
      <Outlet />
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
