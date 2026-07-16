import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "./app-layout";
import { DashboardRoute } from "./dashboard-route";
import { KeysRoute } from "./keys-route";
import { LoginRoute } from "./login-route";
import { PromptRoute } from "./prompt/prompt-route";
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
  component: DashboardRoute,
});

const promptRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/prompt",
  component: PromptRoute,
});

const keysRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/keys",
  component: KeysRoute,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginRoute,
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
