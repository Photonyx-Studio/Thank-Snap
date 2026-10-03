import "./sentry.server";
import * as Sentry from "@sentry/react-router";
import { handleRequest } from "@vercel/react-router/entry.server";
import type { AppLoadContext, EntryContext } from "react-router";
import { addDocumentResponseHeaders } from "./shopify.server";

// Called by React Router whenever a loader/action throws an unhandled error —
// independent of the request handler below, so this reports crashes
// regardless of which renderer produces the response.
export const handleError = Sentry.createSentryHandleError({ logErrors: true });

export default async function (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  loadContext?: AppLoadContext,
): Promise<Response> {
  addDocumentResponseHeaders(request, responseHeaders);
  return handleRequest(
    request,
    responseStatusCode,
    responseHeaders,
    reactRouterContext,
    loadContext,
  );
}
