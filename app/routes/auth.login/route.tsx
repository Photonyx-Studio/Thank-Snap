import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { LoaderFunctionArgs } from "react-router";

import { login } from "../../shopify.server";

// `login()` only reaches this component when the request carries no `shop`
// query param - i.e. someone navigated here directly rather than arriving
// via a Shopify-owned surface (App Store listing, admin) that already
// supplies `shop`. Per App Store requirement 2.3.1, installs/logins must be
// initiated from Shopify, so this page must not collect a manually typed
// shop domain - it only points merchants back to their admin.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await login(request);

  return null;
};

export default function Auth() {
  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Log in">
          <s-paragraph>
            Open thank-snap from the Apps section of your Shopify admin to
            log in.
          </s-paragraph>
        </s-section>
      </s-page>
    </AppProvider>
  );
}
