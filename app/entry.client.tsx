import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// Baked in at build time via Vite's import.meta.env (requires the VITE_
// prefix to be exposed to client code) — guarded the same way as the server
// init, so the app hydrates identically until a real DSN is configured.
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: []
    },
    // replayIntegration is re-exported from @sentry/browser via this
    // package's browser build (see the onError comment below) - the
    // resolver doesn't follow it.
    // eslint-disable-next-line import/namespace
    integrations: [Sentry.replayIntegration()],
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions are recorded — raise this in development if you want to see replays more often.
    replaysOnErrorSampleRate: 1.0, // Always capture a replay when a session has an error.
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      {/* eslint-disable-next-line import/namespace -- @sentry/react-router
      exports sentryOnError from its browser build (verified against the
      compiled package and via tsc); eslint-plugin-import's resolver doesn't
      follow the package's "browser" conditional export and checks the
      server build's types instead, which don't have it. */}
      <HydratedRouter onError={dsn ? Sentry.sentryOnError : undefined} />
    </StrictMode>,
  );
});
