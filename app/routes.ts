import { flatRoutes } from "@react-router/fs-routes";

// Test files live next to the route files they cover (api.active-survey.test.ts,
// etc.) — without this, flatRoutes() treats them as route modules too, and the
// app's dev server ends up executing their vi.mock() calls outside Vitest.
export default flatRoutes({ ignoredRouteFiles: ["**/*.test.{ts,tsx}"] });
