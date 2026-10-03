import * as Sentry from "@sentry/react-router";

// Guarded on SENTRY_DSN being set so the app runs identically to today (no
// crashes, no noisy SDK warnings) until a real DSN is configured. Sentry's
// SDK no-ops safely if capture methods are called before/without init.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Error capture only for now — no performance tracing/profiling, to stay
    // inside Sentry's free-tier transaction quota. Raise this (and add
    // reactRouterTracingIntegration on the client) later if you want it.
    tracesSampleRate: 0,
  });
}
