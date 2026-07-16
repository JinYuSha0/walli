import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "./app-layout";
import {
  LazyDashboardRoute,
  LazyKeysRoute,
  LazyLoginRoute,
  LazyPromptRoute,
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

const promptRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/prompt",
  component: LazyPromptRoute,
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
  appLayoutRoute.addChildren([indexRoute, promptRoute, keysRoute]),
  loginRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
