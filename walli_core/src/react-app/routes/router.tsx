import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
} from "@tanstack/react-router";
import { AppLayout } from "./app-layout";
import {
  LazyDashboardRoute,
  LazyKeysRoute,
  LazyLoginRoute,
  LazySettingsRoute,
} from "./lazy-routes";
import { RootLayout } from "./root-layout";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: LazyDashboardRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: () => (
    <Navigate
      to="/settings/$tab"
      params={{
        tab: "model",
      }}
      replace
    />
  ),
});

const settingsTabRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/$tab",
  component: LazySettingsRoute,
});

const keysRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/keys",
  component: LazyKeysRoute,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LazyLoginRoute,
});

const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([indexRoute, settingsRoute, settingsTabRoute, keysRoute]),
  loginRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
