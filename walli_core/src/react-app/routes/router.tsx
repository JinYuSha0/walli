import { createRootRoute, createRoute, createRouter, Navigate } from "@tanstack/react-router";
import { AppLayout } from "./app-layout";
import {
  LazyDashboardRoute,
  LazyDatasetsRoute,
  LazyNewDatasetModelRoute,
  LazyNewDatasetRecordRoute,
  LazyEditDatasetRecordRoute,
  LazyWebChatRoute,
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
        tab: "basic",
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
  component: LazyClientsRoute,
});

const clientsPlatformRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/clients/$platform",
  component: LazyClientsRoute,
});

const clientsPlatformTabRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/clients/$platform/$tab",
  component: LazyClientsRoute,
});

const datasetsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/datasets",
  component: LazyDatasetsRoute,
});
const datasetRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/datasets/$datasetId",
  component: LazyDatasetsRoute,
});

const newDatasetModelRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/datasets/$datasetId/models/new",
  component: LazyNewDatasetModelRoute,
});
const newDatasetRecordRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/datasets/$datasetId/records/new",
  component: LazyNewDatasetRecordRoute,
});

const editDatasetRecordRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/datasets/$datasetId/records/$recordId/edit",
  component: LazyEditDatasetRecordRoute,
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

const webChatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat/$slug",
  component: LazyWebChatRoute,
});

const webChatSessionRoute = createRoute({ getParentRoute: () => webChatRoute, path: "$sessionId" });

const routeTree = rootRoute.addChildren([
  webChatRoute.addChildren([webChatSessionRoute]),
  appLayoutRoute.addChildren([
    indexRoute,
    datasetsRoute,
    datasetRoute,
    newDatasetModelRoute,
    newDatasetRecordRoute,
    editDatasetRecordRoute,
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
