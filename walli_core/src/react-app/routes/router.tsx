import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
} from "@tanstack/react-router";
import { AppLayout } from "./app-layout";
import {
  LazyDashboardRoute,
  LazyClientsRoute,
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

const clientsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/clients",
  component: () => (
    <Navigate
      to="/clients/$platform/$tab"
      params={{
        platform: "web",
        tab: "client-id",
      }}
      replace
    />
  ),
});

const clientsPlatformRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/clients/$platform",
  component: () => {
    const { platform } = clientsPlatformRoute.useParams();

    return (
      <Navigate
        to="/clients/$platform/$tab"
        params={{
          platform,
          tab: "client-id",
        }}
        replace
      />
    );
  },
});

const clientsPlatformTabRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/clients/$platform/$tab",
  component: LazyClientsRoute,
});

const legacyKeysRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/keys",
  component: () => <Navigate to="/clients" replace />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LazyLoginRoute,
});

const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    indexRoute,
    settingsRoute,
    settingsTabRoute,
    clientsRoute,
    clientsPlatformRoute,
    clientsPlatformTabRoute,
    legacyKeysRoute,
  ]),
  loginRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
